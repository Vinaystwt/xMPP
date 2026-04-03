import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
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

async function ensureBootstrapped(client: DynamicContractClient, admin: string) {
  if (typeof client.admin !== 'function' || typeof client.bootstrap !== 'function') {
    throw new Error('Policy contract does not expose admin/bootstrap methods.')
  }

  const currentAdmin = await client.admin()
  if (currentAdmin.result) {
    return
  }

  const tx = await client.bootstrap({ admin })
  await tx.signAndSend()
}

function toUsdCents(value: number) {
  return BigInt(Math.round(value * 100))
}

async function main() {
  const addresses = await loadContractAddresses()
  const policyContractId = addresses.policyContractId ?? config.contracts.policyContractId
  if (!policyContractId) {
    throw new Error('Policy contract id is missing from config and addresses.json.')
  }

  const client = await createClient(policyContractId)
  const agentKeypair = getAgentKeypair()
  await ensureBootstrapped(client, agentKeypair.publicKey())

  const globalPolicyTx = await client.set_global_policy({
    policy: {
      max_spend_usd_cents: toUsdCents(config.dailyBudgetUsd),
      allow_unknown_services: false,
      allow_post_autopay: false,
    },
  })
  await globalPolicyTx.signAndSend()

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
    const tx = await client.set_service_policy({
      service_id: entry.serviceId,
      policy: entry.policy,
    })
    await tx.signAndSend()
  }

  for (const profile of listXmppAgentProfiles()) {
    const tx = await client.set_agent_policy({
      agent_id: profile.agentId,
      policy: {
        agent_id: profile.agentId,
        enabled: profile.enabled ?? true,
        daily_budget_usd_cents: toUsdCents(profile.dailyBudgetUsd),
        allowed_services: [...profile.allowedServices],
        preferred_routes: [...profile.preferredRoutes],
        autopay_methods: [...profile.autopayMethods],
      },
    })
    await tx.signAndSend()
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        policyContractId,
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
