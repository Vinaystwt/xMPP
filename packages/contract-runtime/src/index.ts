import { Keypair } from '@stellar/stellar-sdk'
import { Client, basicNodeSigner } from '@stellar/stellar-sdk/contract'
import { config } from '@xmpp/config'
import { logger } from '@xmpp/logger'
import type { RouteKind, XmppAgentPolicySnapshot, XmppSessionRecord } from '@xmpp/types'

type DynamicContractClient = Client &
  Record<
    string,
    (
      args?: Record<string, unknown>,
      methodOptions?: Record<string, unknown>,
    ) => Promise<{ result: unknown; signAndSend: () => Promise<{ result: unknown }> }>
  >

type ContractGlobalPolicy = {
  max_spend_usd_cents: bigint | number
  allow_unknown_services: boolean
  allow_post_autopay: boolean
}

type ContractServicePolicy = {
  service_id: string
  enabled: boolean
  max_spend_usd_cents: bigint | number
  preferred_route: string
  allow_session_reuse: boolean
}

type ContractAgentPolicy = {
  agent_id: string
  enabled: boolean
  daily_budget_usd_cents: bigint | number
  allowed_services: string[]
  preferred_routes: string[]
  autopay_methods: string[]
}

export type PolicyRuntimeSnapshot = {
  source: 'local' | 'contract' | 'fallback'
  pauseFlag: boolean
  globalPolicy: {
    maxSpendUsdCents: number
    allowUnknownServices: boolean
    allowPostAutopay: boolean
  } | null
  servicePolicy: {
    serviceId: string
    enabled: boolean
    maxSpendUsdCents: number
    preferredRoute: string
    allowSessionReuse: boolean
  } | null
}

export type AgentPolicyRuntimeSnapshot = {
  source: 'local' | 'contract' | 'fallback'
  agentPolicy: XmppAgentPolicySnapshot | null
}

export type SessionRouteEventInput = {
  sessionId: string
  serviceId: string
  route: RouteKind
  status: 'open' | 'reused' | 'closed'
  callCount: number
  receiptId: string
  totalAmountUsdCents?: number
}

let policyClientPromise: Promise<DynamicContractClient | null> | undefined
let sessionRegistryClientPromise: Promise<DynamicContractClient | null> | undefined
let policyClientDisabled = false
let sessionRegistryClientDisabled = false

function contractRuntimeEnabled() {
  return process.env.VITEST !== 'true' && process.env.XMPP_DISABLE_CONTRACT_RUNTIME !== 'true'
}

function toNumber(value: bigint | number | undefined) {
  return value == null ? 0 : Number(value)
}

function normalizeStringList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((entry) => String(entry))
  }

  if (value && typeof value === 'object' && Symbol.iterator in value) {
    return [...(value as Iterable<unknown>)].map((entry) => String(entry))
  }

  return []
}

function getAgentKeypair() {
  if (!config.wallet.agentSecretKey) {
    return null
  }

  try {
    return Keypair.fromSecret(config.wallet.agentSecretKey)
  } catch (error) {
    logger.warn({ error }, '[xMPP] failed to parse agent secret key for contract runtime')
    return null
  }
}

function getClientOptions(contractId: string) {
  const keypair = getAgentKeypair()
  if (!keypair) {
    return null
  }

  return {
    contractId,
    rpcUrl: config.rpcUrl,
    networkPassphrase: config.networkPassphrase,
    allowHttp: config.rpcUrl.startsWith('http://'),
    publicKey: keypair.publicKey(),
    ...basicNodeSigner(keypair, config.networkPassphrase),
  }
}

async function createClient(contractId: string, label: string) {
  const options = getClientOptions(contractId)
  if (!options) {
    logger.debug({ label }, '[xMPP] contract runtime disabled because no agent signer is available')
    return null
  }

  try {
    return (await Client.from(options)) as DynamicContractClient
  } catch (error) {
    logger.warn({ error, contractId, label }, '[xMPP] failed to create Soroban contract client')
    return null
  }
}

function hasMethod(client: DynamicContractClient, method: string, label: string) {
  if (typeof client[method] === 'function') {
    return true
  }

  logger.warn({ label, method }, '[xMPP] contract method is unavailable on deployed contract')
  return false
}

async function getPolicyClient() {
  if (!contractRuntimeEnabled() || !config.contracts.policyContractId || policyClientDisabled) {
    return null
  }

  policyClientPromise ??= createClient(config.contracts.policyContractId, 'policy')
  const client = await policyClientPromise
  if (!client) {
    policyClientDisabled = true
    return null
  }

  if (!hasMethod(client, 'get_global_policy', 'policy') || !hasMethod(client, 'pause_flag', 'policy')) {
    policyClientDisabled = true
    return null
  }

  return client
}

async function getSessionRegistryClient() {
  if (
    !contractRuntimeEnabled() ||
    !config.contracts.sessionRegistryContractId ||
    sessionRegistryClientDisabled
  ) {
    return null
  }

  sessionRegistryClientPromise ??= createClient(config.contracts.sessionRegistryContractId, 'session-registry')
  const client = await sessionRegistryClientPromise
  if (!client) {
    sessionRegistryClientDisabled = true
    return null
  }

  if (!hasMethod(client, 'upsert_session', 'session-registry')) {
    sessionRegistryClientDisabled = true
    return null
  }

  return client
}

function normalizeGlobalPolicy(policy: ContractGlobalPolicy) {
  return {
    maxSpendUsdCents: toNumber(policy.max_spend_usd_cents),
    allowUnknownServices: policy.allow_unknown_services,
    allowPostAutopay: policy.allow_post_autopay,
  }
}

function normalizeServicePolicy(policy: ContractServicePolicy | null | undefined) {
  if (!policy) {
    return null
  }

  return {
    serviceId: policy.service_id,
    enabled: policy.enabled,
    maxSpendUsdCents: toNumber(policy.max_spend_usd_cents),
    preferredRoute: policy.preferred_route,
    allowSessionReuse: policy.allow_session_reuse,
  }
}

function normalizeAgentPolicy(policy: ContractAgentPolicy | null | undefined): XmppAgentPolicySnapshot | null {
  if (!policy) {
    return null
  }

  return {
    agentId: policy.agent_id,
    enabled: policy.enabled,
    dailyBudgetUsd: toNumber(policy.daily_budget_usd_cents) / 100,
    allowedServices: normalizeStringList(policy.allowed_services),
    preferredRoutes: normalizeStringList(policy.preferred_routes) as RouteKind[],
    autopayMethods: normalizeStringList(policy.autopay_methods),
    source: 'contract',
  }
}

function normalizeSessionRecord(record: Record<string, unknown>): XmppSessionRecord {
  return {
    sessionId: String(record.session_id ?? ''),
    serviceId: String(record.service_id ?? ''),
    agent: String(record.agent ?? ''),
    channelContractId: String(record.channel_contract_id ?? ''),
    route: String(record.route ?? ''),
    status: String(record.status ?? ''),
    totalAmountUsdCents: toNumber(record.total_amount_usd_cents as bigint | number | undefined),
    callCount: Number(record.call_count ?? 0),
    lastReceiptId: String(record.last_receipt_id ?? ''),
    updatedAtLedger: Number(record.updated_at_ledger ?? 0),
  }
}

export async function getAgentPolicySnapshot(agentId: string): Promise<AgentPolicyRuntimeSnapshot> {
  const client = await getPolicyClient()
  if (!client || !hasMethod(client, 'get_agent_policy', 'policy')) {
    return {
      source: 'local',
      agentPolicy: null,
    }
  }

  try {
    const tx = await client.get_agent_policy({ agent_id: agentId })
    return {
      source: 'contract',
      agentPolicy: normalizeAgentPolicy(
        (tx.result as ContractAgentPolicy | null | undefined) ?? null,
      ),
    }
  } catch (error) {
    logger.warn({ error, agentId }, '[xMPP] failed to read agent policy from contract, falling back')
    return {
      source: 'fallback',
      agentPolicy: null,
    }
  }
}

export async function listAgentPolicySnapshots(): Promise<XmppAgentPolicySnapshot[]> {
  const client = await getPolicyClient()
  if (!client || !hasMethod(client, 'list_agent_policies', 'policy')) {
    return []
  }

  try {
    const tx = await client.list_agent_policies()
    const result = tx.result as Array<ContractAgentPolicy> | null | undefined
    return Array.isArray(result)
      ? result.filter((entry): entry is ContractAgentPolicy => Boolean(entry)).flatMap((entry) => {
          const normalized = normalizeAgentPolicy(entry)
          return normalized ? [normalized] : []
        })
      : []
  } catch (error) {
    logger.warn({ error }, '[xMPP] failed to list agent policies from contract')
    return []
  }
}

export async function getPolicyRuntimeSnapshot(serviceId?: string): Promise<PolicyRuntimeSnapshot> {
  const client = await getPolicyClient()
  if (!client) {
    return {
      source: 'local',
      pauseFlag: false,
      globalPolicy: null,
      servicePolicy: null,
    }
  }

  try {
    const globalPolicyTx = await client.get_global_policy()
    const pauseFlagTx = await client.pause_flag()
    const servicePolicyTx =
      serviceId && hasMethod(client, 'get_service_policy', 'policy')
        ? await client.get_service_policy({ service_id: serviceId })
        : null

    return {
      source: 'contract',
      pauseFlag: Boolean(pauseFlagTx.result),
      globalPolicy: normalizeGlobalPolicy(globalPolicyTx.result as ContractGlobalPolicy),
      servicePolicy: normalizeServicePolicy(
        (servicePolicyTx?.result as ContractServicePolicy | null | undefined) ?? null,
      ),
    }
  } catch (error) {
    logger.warn({ error, serviceId }, '[xMPP] failed to read policy from contract, falling back')
    return {
      source: 'fallback',
      pauseFlag: false,
      globalPolicy: null,
      servicePolicy: null,
    }
  }
}

export async function recordSessionRouteEvent(
  input: SessionRouteEventInput,
): Promise<XmppSessionRecord | null> {
  const client = await getSessionRegistryClient()
  const keypair = getAgentKeypair()
  if (!client || !keypair) {
    return null
  }

  try {
    const tx = await client.upsert_session({
      agent: keypair.publicKey(),
      session_id: input.sessionId,
      service_id: input.serviceId,
      channel_contract_id: config.mpp.channelContractId ?? '',
      route: input.route,
      total_amount_usd_cents: BigInt(input.totalAmountUsdCents ?? 0),
      call_count: input.callCount,
      last_receipt_id: input.receiptId,
      status: input.status,
    })
    const sent = await tx.signAndSend()
    return normalizeSessionRecord(sent.result as Record<string, unknown>)
  } catch (error) {
    logger.warn({ error, input }, '[xMPP] failed to write session route event to contract')
    return null
  }
}

export async function listAgentSessions(): Promise<XmppSessionRecord[]> {
  const client = await getSessionRegistryClient()
  const keypair = getAgentKeypair()
  if (!client || !keypair || !hasMethod(client, 'list_agent_sessions', 'session-registry')) {
    return []
  }

  try {
    const tx = await client.list_agent_sessions({ agent: keypair.publicKey() })
    const result = tx.result as Array<Record<string, unknown>> | null | undefined
    return Array.isArray(result) ? result.map(normalizeSessionRecord) : []
  } catch (error) {
    logger.warn({ error }, '[xMPP] failed to list agent sessions from contract')
    return []
  }
}
