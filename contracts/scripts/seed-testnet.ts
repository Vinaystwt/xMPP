import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'
import { Keypair } from '@stellar/stellar-sdk'
import { Client, basicNodeSigner } from '@stellar/stellar-sdk/contract'
import { config } from '../../packages/config/src/index.js'
import { listXmppAgentProfiles } from '../../packages/http-interceptor/src/agents.js'

type DynamicContractClient = Client &
  Record<
    string,
    (
      args?: Record<string, unknown>,
      methodOptions?: Record<string, unknown>,
    ) => Promise<{ result: unknown; signAndSend: () => Promise<{ result: unknown }> }>
  >

type ContractAddresses = {
  policyContractId?: string
  sessionRegistryContractId?: string
}

const repoRoot = resolve(fileURLToPath(new URL('../../', import.meta.url)))
const addressesPath = resolve(repoRoot, 'contracts/scripts/addresses.json')
const MAX_SEND_RETRIES = 4

async function loadContractAddresses(): Promise<ContractAddresses> {
  const content = await readFile(addressesPath, 'utf8')
  return JSON.parse(content) as ContractAddresses
}

function getAgentKeypair() {
  if (!config.wallet.agentSecretKey) {
    throw new Error('XMPP_AGENT_SECRET_KEY is required to seed contract policies.')
  }

  return Keypair.fromSecret(config.wallet.agentSecretKey)
}

async function createClient(contractId: string) {
  const keypair = getAgentKeypair()

  return (await Client.from({
    contractId,
    rpcUrl: config.rpcUrl,
    networkPassphrase: config.networkPassphrase,
    allowHttp: config.rpcUrl.startsWith('http://'),
    publicKey: keypair.publicKey(),
    ...basicNodeSigner(keypair, config.networkPassphrase),
  })) as DynamicContractClient
}

function isRetryableSendError(error: unknown) {
  const responseStatus =
    typeof error === 'object' &&
    error !== null &&
    'response' in error &&
    typeof (error as { response?: unknown }).response === 'object'
      ? (error as { response?: { status?: unknown } }).response?.status
      : undefined
  const directStatus =
    typeof error === 'object' && error !== null && 'status' in error
      ? (error as { status?: unknown }).status
      : undefined
  const serializedError =
    error instanceof Error ? error.message : JSON.stringify(error)

  return (
    responseStatus === 'TRY_AGAIN_LATER' ||
    directStatus === 'TRY_AGAIN_LATER' ||
    serializedError.includes('TRY_AGAIN_LATER') ||
    serializedError.includes('txBadSeq')
  )
}

async function runMutationWithRetry(
  createTx: () => Promise<{ signAndSend: () => Promise<unknown> }>,
  label: string,
) {
  let lastError: unknown

  for (let attempt = 1; attempt <= MAX_SEND_RETRIES; attempt += 1) {
    try {
      const tx = await createTx()
      return await tx.signAndSend()
    } catch (error) {
      lastError = error

      if (!isRetryableSendError(error) || attempt === MAX_SEND_RETRIES) {
        throw error
      }

      console.warn(`[xMPP seed] ${label} hit a transient send error, retrying (${attempt}/${MAX_SEND_RETRIES})`)
      await delay(1500 * attempt)
    }
  }

  throw lastError
}

async function closeExistingSessions(sessionRegistryContractId?: string) {
  if (!sessionRegistryContractId) {
    return
  }

  const client = await createClient(sessionRegistryContractId)
  if (
    typeof client.list_agent_sessions !== 'function' ||
    typeof client.close_session !== 'function'
  ) {
    return
  }

  const agentKeypair = getAgentKeypair()
  const existingSessionsTx = await client.list_agent_sessions({ agent: agentKeypair.publicKey() })
  const existingSessions = Array.isArray(existingSessionsTx.result)
    ? existingSessionsTx.result
    : []

  for (const session of existingSessions) {
    if (!session || typeof session !== 'object') {
      continue
    }

    const status = String((session as Record<string, unknown>).status ?? '')
    if (status === 'closed') {
      continue
    }

    await runMutationWithRetry(
      () =>
        client.close_session({
          agent: agentKeypair.publicKey(),
          session_id: String((session as Record<string, unknown>).session_id ?? ''),
          total_amount_usd_cents: BigInt(
            Number((session as Record<string, unknown>).total_amount_usd_cents ?? 0),
          ),
          call_count: Number((session as Record<string, unknown>).call_count ?? 0),
          last_receipt_id: String((session as Record<string, unknown>).last_receipt_id ?? ''),
        }),
      'close stale session',
    )
  }
}

async function ensureBootstrapped(client: DynamicContractClient, admin: string) {
  if (typeof client.admin !== 'function' || typeof client.bootstrap !== 'function') {
    throw new Error('Policy contract does not expose admin/bootstrap methods.')
  }

  const currentAdmin = await client.admin()
  if (currentAdmin.result) {
    return
  }

  await runMutationWithRetry(() => client.bootstrap({ admin }), 'bootstrap policy contract')
}

function toUsdCents(value: number) {
  return BigInt(Math.round(value * 100))
}

async function main() {
  const addresses = await loadContractAddresses()
  const policyContractId = addresses.policyContractId ?? config.contracts.policyContractId
  const sessionRegistryContractId =
    addresses.sessionRegistryContractId ?? config.contracts.sessionRegistryContractId
  if (!policyContractId) {
    throw new Error('Policy contract id is missing from config and addresses.json.')
  }

  const client = await createClient(policyContractId)
  const agentKeypair = getAgentKeypair()
  await ensureBootstrapped(client, agentKeypair.publicKey())

  await runMutationWithRetry(
    () =>
      client.set_global_policy({
        policy: {
          max_spend_usd_cents: toUsdCents(config.dailyBudgetUsd),
          allow_unknown_services: false,
          allow_post_autopay: false,
        },
      }),
    'set global policy',
  )

  if (typeof client.set_shared_treasury_usd_cents === 'function') {
    await runMutationWithRetry(
      () =>
        client.set_shared_treasury_usd_cents({
          amount_usd_cents: toUsdCents(config.dailyBudgetUsd),
        }),
      'set shared treasury',
    )
  }

  if (typeof client.reset_treasury === 'function') {
    await runMutationWithRetry(() => client.reset_treasury(), 'reset treasury')
  }

  await closeExistingSessions(sessionRegistryContractId)

  const servicePolicies = [
    {
      serviceId: 'research-api',
      policy: {
        service_id: 'research-api',
        enabled: true,
        max_spend_usd_cents: BigInt(10),
        preferred_route: 'x402',
        allow_session_reuse: false,
      },
    },
    {
      serviceId: 'market-api',
      policy: {
        service_id: 'market-api',
        enabled: true,
        max_spend_usd_cents: BigInt(35),
        preferred_route: 'mpp-charge',
        allow_session_reuse: false,
      },
    },
    {
      serviceId: 'stream-api',
      policy: {
        service_id: 'stream-api',
        enabled: true,
        max_spend_usd_cents: BigInt(50),
        preferred_route: 'mpp-session-open',
        allow_session_reuse: true,
      },
    },
  ]

  for (const entry of servicePolicies) {
    await runMutationWithRetry(
      () =>
        client.set_service_policy({
          service_id: entry.serviceId,
          policy: entry.policy,
        }),
      `set service policy ${entry.serviceId}`,
    )
  }

  for (const profile of listXmppAgentProfiles()) {
    await runMutationWithRetry(
      () =>
        client.set_agent_policy({
          agent_id: profile.agentId,
          policy: {
            agent_id: profile.agentId,
            enabled: profile.enabled ?? true,
            daily_budget_usd_cents: toUsdCents(profile.dailyBudgetUsd),
            allowed_services: [...profile.allowedServices],
            preferred_routes: [...profile.preferredRoutes],
            autopay_methods: [...profile.autopayMethods],
          },
        }),
      `set agent policy ${profile.agentId}`,
    )
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        policyContractId,
        sessionRegistryContractId,
        seededServicePolicies: servicePolicies.map((entry) => entry.serviceId),
        seededAgentPolicies: listXmppAgentProfiles().map((profile) => profile.agentId),
      },
      null,
      2,
    ),
  )
}

main().catch((error) => {
  console.error('[xMPP seed] failed', error)
  process.exit(1)
})
