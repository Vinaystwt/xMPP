import { createRouter, estimateRouteCost } from '@xmpp/router'
import {
  getAgentTreasuryState,
  getAgentPolicySnapshot,
  getTreasurySnapshot,
  listAgentPolicySnapshots,
  getPolicyRuntimeSnapshot,
  recordTreasurySpend,
  recordSessionRouteEvent,
} from '@xmpp/contract-runtime'
import { executePaymentRoute, preparePaymentExecution } from '@xmpp/payment-adapters'
import { config } from '@xmpp/config'
import { evaluatePolicyForRequest } from '@xmpp/policy-engine'
import type {
  PaymentChallenge,
  XmppAgentPolicySnapshot,
  XmppAgentProfile,
  XmppFetchMetadata,
  XmppFetchOptions,
} from '@xmpp/types'
import { signXmppReceipt } from '@xmpp/wallet'
import {
  buildIdempotentReplay,
  clearIdempotentReservation,
  inspectIdempotency,
  storeIdempotentResponse,
} from './idempotency.js'
import {
  buildBudgetSnapshot,
  getXmppOperatorState,
  listLocalSessions,
  recordXmppEvent,
  resetXmppOperatorState,
  upsertLocalSession,
} from './state.js'
import {
  applyAgentPolicy,
  getXmppAgentProfile,
  listXmppAgentProfiles,
  mergeAgentPolicies,
} from './agents.js'

const router = createRouter()
const sessionRegistry = new Map<string, { sessionId: string; callCount: number }>()

function resolveUrl(input: RequestInfo | URL) {
  return typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
}

async function parseChallenge(resp: Response): Promise<PaymentChallenge | null> {
  const contentType = resp.headers.get('content-type') ?? ''
  if (!contentType.includes('application/json')) {
    return null
  }

  const body = (await resp.clone().json()) as Partial<PaymentChallenge>
  if (!body.kind || !body.service || !body.retryHeaderName || !body.retryHeaderValue) {
    return null
  }

  return {
    kind: body.kind,
    service: body.service,
    amountUsd: body.amountUsd ?? 0,
    asset: 'USDC_TESTNET',
    retryHeaderName: body.retryHeaderName,
    retryHeaderValue: body.retryHeaderValue,
    sessionId: body.sessionId,
  }
}

function setMetadata(resp: Response, metadata: XmppFetchMetadata) {
  Object.defineProperty(resp, '__xmpp', {
    configurable: true,
    enumerable: false,
    value: metadata,
  })
  return resp
}

export function getXmppMetadata(resp: Response): XmppFetchMetadata | undefined {
  return (resp as Response & { __xmpp?: XmppFetchMetadata }).__xmpp
}

export { getXmppOperatorState, listLocalSessions, listXmppAgentProfiles, resetXmppOperatorState }

function withLocalAgentDefaults(agent: XmppAgentProfile) {
  return {
    ...agent,
    enabled: agent.enabled ?? true,
    policySource: agent.policySource ?? 'local',
  }
}

function createSyntheticAgentProfile(policy: XmppAgentPolicySnapshot): XmppAgentProfile {
  return {
    agentId: policy.agentId,
    displayName: policy.agentId,
    role: 'shared',
    description: 'Contract-defined treasury agent surfaced through xMPP runtime policy.',
    dailyBudgetUsd: policy.dailyBudgetUsd,
    allowedServices: [...policy.allowedServices],
    preferredRoutes: [...policy.preferredRoutes],
    autopayMethods: [...policy.autopayMethods],
    enabled: policy.enabled,
    policySource: 'contract',
  }
}

export async function getEffectiveXmppAgentProfile(agentId?: string) {
  const local = withLocalAgentDefaults(getXmppAgentProfile(agentId))
  const runtime = await getAgentPolicySnapshot(local.agentId)
  if (runtime.source === 'contract' && runtime.agentPolicy) {
    return applyAgentPolicy(local, runtime.agentPolicy)
  }

  return {
    ...local,
    policySource: runtime.source === 'fallback' ? 'fallback' : local.policySource,
  }
}

export async function listEffectiveXmppAgentProfiles() {
  const localProfiles = listXmppAgentProfiles().map(withLocalAgentDefaults)
  const contractPolicies = await listAgentPolicySnapshots()
  if (contractPolicies.length === 0) {
    return localProfiles
  }

  const mergedProfiles = mergeAgentPolicies(localProfiles, contractPolicies)
  const knownAgentIds = new Set(mergedProfiles.map((profile) => profile.agentId))

  for (const policy of contractPolicies) {
    if (!knownAgentIds.has(policy.agentId)) {
      mergedProfiles.push(createSyntheticAgentProfile(policy))
    }
  }

  return mergedProfiles
}

function decodeEvidenceHeader(value?: string) {
  if (!value) {
    return null
  }

  try {
    return JSON.parse(Buffer.from(value, 'base64').toString('utf8')) as Record<string, unknown>
  } catch {
    return null
  }
}

function extractExplorerDetails(evidenceHeaders?: Record<string, string>) {
  if (!evidenceHeaders) {
    return {}
  }

  const directTxHash =
    evidenceHeaders['x-payment-response-tx-hash'] ??
    evidenceHeaders['x-mpp-transaction-hash'] ??
    evidenceHeaders['x-payment-transaction'] ??
    evidenceHeaders['x-mpp-receipt-tx']
  if (directTxHash) {
    return {
      txHash: directTxHash,
      explorerUrl: `https://stellar.expert/explorer/testnet/tx/${directTxHash}`,
    }
  }

  const paymentResponse = decodeEvidenceHeader(evidenceHeaders['payment-response'])
  const paymentReceipt = decodeEvidenceHeader(evidenceHeaders['payment-receipt'])
  const responseHash =
    (typeof paymentResponse?.transaction === 'string' && paymentResponse.transaction) ||
    (typeof paymentReceipt?.reference === 'string' &&
    /^[a-f0-9]{64}$/i.test(paymentReceipt.reference)
      ? paymentReceipt.reference
      : undefined)

  if (!responseHash) {
    return {}
  }

  return {
    txHash: responseHash,
    explorerUrl: `https://stellar.expert/explorer/testnet/tx/${responseHash}`,
  }
}

function extractPaymentReference(evidenceHeaders?: Record<string, string>) {
  if (!evidenceHeaders) {
    return undefined
  }

  const paymentResponse = decodeEvidenceHeader(evidenceHeaders['payment-response'])
  const paymentReceipt = decodeEvidenceHeader(evidenceHeaders['payment-receipt'])
  if (typeof paymentResponse?.transaction === 'string') {
    return paymentResponse.transaction
  }
  if (typeof paymentReceipt?.reference === 'string') {
    return paymentReceipt.reference
  }
  return undefined
}

function attachSignedReceipt(input: {
  metadata: XmppFetchMetadata['execution']
  url: string
  method: string
  serviceId: string
  route: XmppFetchMetadata['route']
  amountUsd: number
}) {
  if (!input.metadata) {
    return input.metadata
  }

  const explorer = extractExplorerDetails(input.metadata.evidenceHeaders)
  const signedReceipt = signXmppReceipt({
    receiptId: input.metadata.receiptId,
    serviceId: input.serviceId,
    url: input.url,
    method: input.method,
    route: input.route,
    amountUsd: input.amountUsd,
    txHash: explorer.txHash,
    explorerUrl: explorer.explorerUrl,
    paymentReference: extractPaymentReference(input.metadata.evidenceHeaders),
  })

  return signedReceipt
    ? {
        ...input.metadata,
        signedReceipt,
      }
    : input.metadata
}

async function evaluateSpendPolicy(input: {
  agent: XmppAgentProfile
  serviceId?: string
  amountUsd: number
  route: XmppFetchMetadata['route']
}) {
  const runtime = await getPolicyRuntimeSnapshot(input.serviceId)
  const state = getXmppOperatorState()
  const amountUsdCents = Math.round(input.amountUsd * 100)
  const agentPolicySource: 'contract' | 'local' =
    input.agent.policySource === 'merged' ? 'contract' : 'local'
  const [contractTreasury, contractAgentTreasury] = await Promise.all([
    getTreasurySnapshot(),
    getAgentTreasuryState(input.agent.agentId),
  ])
  const effectiveSharedTreasuryUsd = Math.max(
    config.dailyBudgetUsd,
    contractTreasury?.sharedTreasuryUsd ?? 0,
  )
  const effectiveOperatorSpentUsd = Math.max(
    state.spentThisSessionUsd,
    contractTreasury?.totalSpentUsd ?? 0,
  )

  if (effectiveOperatorSpentUsd + input.amountUsd > effectiveSharedTreasuryUsd + 1e-9) {
    return {
      allowed: false,
      reason: 'xMPP blocked automatic payment because it would exceed the operator daily budget.',
      code: 'blocked-budget' as const,
      source: contractTreasury ? 'contract' : runtime.source,
    }
  }

  const agentState = state.agentStates.find((entry) => entry.agentId === input.agent.agentId)
  const effectiveAgentSpentUsd = Math.max(
    agentState?.spentThisSessionUsd ?? 0,
    contractAgentTreasury?.spentUsd ?? 0,
  )
  if (effectiveAgentSpentUsd + input.amountUsd > input.agent.dailyBudgetUsd + 1e-9) {
    return {
      allowed: false,
      reason: `${input.agent.displayName} would exceed its daily treasury allocation.`,
      code: 'blocked-budget' as const,
      source: contractAgentTreasury ? 'contract' : agentPolicySource,
    }
  }

  if (
    runtime.globalPolicy &&
    runtime.globalPolicy.maxSpendUsdCents > 0 &&
    amountUsdCents > runtime.globalPolicy.maxSpendUsdCents
  ) {
    return {
      allowed: false,
      reason: 'xMPP policy blocked this payment because it exceeds the global spend ceiling.',
      code: 'blocked-budget' as const,
      source: runtime.source,
    }
  }

  if (
    runtime.servicePolicy &&
    runtime.servicePolicy.maxSpendUsdCents > 0 &&
    amountUsdCents > runtime.servicePolicy.maxSpendUsdCents
  ) {
    return {
      allowed: false,
      reason: 'xMPP policy blocked this payment because it exceeds the service spend ceiling.',
      code: 'blocked-budget' as const,
      source: runtime.source,
    }
  }

  if (
    input.route === 'mpp-session-reuse' &&
    runtime.servicePolicy &&
    !runtime.servicePolicy.allowSessionReuse
  ) {
    return {
      allowed: false,
      reason: 'xMPP policy disabled session reuse for this service.',
      code: 'blocked-service' as const,
      source: runtime.source,
    }
  }

  return null
}

function evaluateAgentAccess(input: {
  agent: XmppAgentProfile
  serviceId?: string
  method: string
  route?: XmppFetchMetadata['route']
}) {
  const upperMethod = input.method.toUpperCase()
  const source: 'contract' | 'local' = input.agent.policySource === 'merged' ? 'contract' : 'local'

  if (input.agent.enabled === false) {
    return {
      allowed: false,
      reason: `${input.agent.displayName} is disabled by xMPP treasury policy.`,
      code: 'blocked-agent' as const,
      source,
    }
  }

  if (!input.agent.autopayMethods.includes(upperMethod)) {
    return {
      allowed: false,
      reason: `${input.agent.displayName} cannot auto-pay ${upperMethod} requests.`,
      code: 'blocked-agent' as const,
      source,
    }
  }

  if (input.serviceId && !input.agent.allowedServices.includes(input.serviceId)) {
    return {
      allowed: false,
      reason: `${input.agent.displayName} is not allowed to spend against ${input.serviceId}.`,
      code: 'blocked-agent' as const,
      source,
    }
  }

  if (input.route && !input.agent.preferredRoutes.includes(input.route)) {
    return {
      allowed: false,
      reason: `${input.agent.displayName} is not configured to use ${input.route}.`,
      code: 'blocked-agent' as const,
      source,
    }
  }

  return null
}

export async function xmppFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
  options?: XmppFetchOptions,
) {
  const url = resolveUrl(input)
  const method = init?.method ?? 'GET'
  const agent = await getEffectiveXmppAgentProfile(options?.agentId)
  const policy = await evaluatePolicyForRequest({
    url,
    method,
    serviceId: options?.serviceId,
  })

  if (!policy.allowed) {
    recordXmppEvent({
      agentId: agent.agentId,
      url,
      method,
      serviceId: options?.serviceId ?? 'unknown-service',
      route: 'x402',
      status: 'denied',
      amountUsd: 0,
      projectedRequests: options?.projectedRequests ?? 1,
      policyCode: policy.code,
    })

    const denied = new Response(
      JSON.stringify({
        error: 'xMPP policy denied automatic payment for this request.',
        policy,
      }),
      {
        status: 403,
        headers: { 'content-type': 'application/json' },
      },
    )

    return setMetadata(denied, {
      route: 'x402',
      retried: false,
      policy,
      budget: buildBudgetSnapshot({
        agentId: agent.agentId,
        agentProfile: agent,
        url,
        method,
        serviceId: options?.serviceId,
        route: 'x402',
        projectedRequests: options?.projectedRequests,
      }),
    })
  }

  const agentAccess = evaluateAgentAccess({ agent, serviceId: options?.serviceId, method })
  if (agentAccess) {
    recordXmppEvent({
      agentId: agent.agentId,
      url,
      method,
      serviceId: options?.serviceId ?? 'unknown-service',
      route: 'x402',
      status: 'denied',
      amountUsd: 0,
      projectedRequests: options?.projectedRequests ?? 1,
      policyCode: agentAccess.code,
    })
    const denied = new Response(
      JSON.stringify({
        error: 'xMPP agent policy denied automatic payment for this request.',
        policy: agentAccess,
      }),
      {
        status: 403,
        headers: { 'content-type': 'application/json' },
      },
    )

    return setMetadata(denied, {
      route: 'x402',
      retried: false,
      policy: agentAccess,
      budget: buildBudgetSnapshot({
        agentId: agent.agentId,
        agentProfile: agent,
        url,
        method,
        serviceId: options?.serviceId,
        route: 'x402',
        projectedRequests: options?.projectedRequests,
      }),
    })
  }

  const idempotency = inspectIdempotency(url, method, init, options)
  if (!idempotency.allowed) {
    const idempotencyPolicy = {
      allowed: false,
      reason: idempotency.reason,
      code: 'blocked-idempotency' as const,
      source: 'local' as const,
    }
    recordXmppEvent({
      agentId: agent.agentId,
      url,
      method,
      serviceId: options?.serviceId ?? 'unknown-service',
      route: 'x402',
      status: 'denied',
      amountUsd: 0,
      projectedRequests: options?.projectedRequests ?? 1,
      policyCode: idempotencyPolicy.code,
    })
    const status = idempotency.code === 'missing-key' ? 428 : 409
    const denied = new Response(
      JSON.stringify({
        error: 'xMPP idempotency policy denied automatic payment for this request.',
        policy: idempotencyPolicy,
      }),
      {
        status,
        headers: { 'content-type': 'application/json' },
      },
    )

    return setMetadata(denied, {
      route: 'x402',
      retried: false,
      policy: idempotencyPolicy,
      budget: buildBudgetSnapshot({
        agentId: agent.agentId,
        agentProfile: agent,
        url,
        method,
        serviceId: options?.serviceId,
        route: 'x402',
        projectedRequests: options?.projectedRequests,
      }),
    })
  }

  if (idempotency.replay) {
    const replay = buildIdempotentReplay(idempotency.response)
    if (replay) {
      return setMetadata(replay.response, replay.metadata)
    }
  }

  const preview = await router.preview({
    url,
    method,
    serviceId: options?.serviceId,
    projectedRequests: options?.projectedRequests,
    streaming: options?.streaming,
  })
  const previewAccess = evaluateAgentAccess({
    agent,
    serviceId: options?.serviceId ?? preview.service?.serviceId,
    method,
    route: preview.route,
  })
  if (previewAccess) {
    if (idempotency.idempotencyKey && idempotency.fingerprint) {
      clearIdempotentReservation(idempotency.idempotencyKey, idempotency.fingerprint)
    }
    recordXmppEvent({
      agentId: agent.agentId,
      url,
      method,
      serviceId: options?.serviceId ?? preview.service?.serviceId ?? 'unknown-service',
      route: preview.route,
      status: 'denied',
      amountUsd: 0,
      projectedRequests: options?.projectedRequests ?? 1,
      policyCode: previewAccess.code,
    })
    const denied = new Response(
      JSON.stringify({
        error: 'xMPP agent policy denied automatic payment for this request.',
        policy: previewAccess,
      }),
      {
        status: 403,
        headers: { 'content-type': 'application/json' },
      },
    )
    return setMetadata(denied, {
      route: preview.route,
      retried: false,
      policy: previewAccess,
      budget: buildBudgetSnapshot({
        agentId: agent.agentId,
        agentProfile: agent,
        url,
        method,
        serviceId: options?.serviceId ?? preview.service?.serviceId,
        route: preview.route,
        projectedRequests: options?.projectedRequests,
      }),
    })
  }

  if (
    (process.env.XMPP_PAYMENT_EXECUTION_MODE ?? config.paymentExecutionMode) === 'testnet'
  ) {
    const sessionKey = `${options?.serviceId ?? url}:${url}`
    const existingSession = sessionRegistry.get(sessionKey)
    const liveRoute =
      preview.route === 'mpp-session-open' && existingSession
        ? 'mpp-session-reuse'
        : preview.route
    const liveAmountUsd = estimateRouteCost({
      route: liveRoute,
      url,
      method,
      serviceId: options?.serviceId ?? preview.service?.serviceId,
      projectedRequests: 1,
      hasReusableSession: Boolean(existingSession),
    })
    const spendPolicy = await evaluateSpendPolicy({
      agent,
      serviceId: options?.serviceId ?? preview.service?.serviceId,
      amountUsd: liveAmountUsd,
      route: liveRoute,
    })
    if (spendPolicy) {
      if (idempotency.idempotencyKey && idempotency.fingerprint) {
        clearIdempotentReservation(idempotency.idempotencyKey, idempotency.fingerprint)
      }
      recordXmppEvent({
        agentId: agent.agentId,
        url,
        method,
        serviceId: options?.serviceId ?? preview.service?.serviceId ?? 'unknown-service',
        route: liveRoute,
        status: 'denied',
        amountUsd: 0,
        projectedRequests: options?.projectedRequests ?? 1,
        policyCode: spendPolicy.code,
      })
      const denied = new Response(
        JSON.stringify({
          error: 'xMPP spend policy denied automatic payment for this request.',
          policy: spendPolicy,
        }),
        {
          status: 403,
          headers: { 'content-type': 'application/json' },
        },
      )
      return setMetadata(denied, {
        route: liveRoute,
        retried: false,
        policy: spendPolicy,
        budget: buildBudgetSnapshot({
          agentId: agent.agentId,
          agentProfile: agent,
          url,
          method,
          serviceId: options?.serviceId ?? preview.service?.serviceId,
          route: liveRoute,
          projectedRequests: options?.projectedRequests,
          hasReusableSession: Boolean(existingSession),
        }),
      })
    }
    const result = await executePaymentRoute(liveRoute, input, init)
    const settled =
      result.metadata.status !== 'missing-config' && result.response.status !== 402
    if (settled && (liveRoute === 'mpp-session-open' || liveRoute === 'mpp-session-reuse')) {
      const nextSession = {
        sessionId: existingSession?.sessionId ?? sessionKey,
        callCount:
          liveRoute === 'mpp-session-open' ? 1 : (existingSession?.callCount ?? 0) + 1,
      }
      sessionRegistry.set(sessionKey, nextSession)
      upsertLocalSession(nextSession.sessionId, options?.serviceId ?? 'unknown-service', nextSession.callCount)
      await recordSessionRouteEvent({
        sessionId: nextSession.sessionId,
        serviceId: options?.serviceId ?? 'unknown-service',
        route: liveRoute,
        status: liveRoute === 'mpp-session-open' ? 'open' : 'reused',
        callCount: nextSession.callCount,
        receiptId: result.metadata.receiptId,
        totalAmountUsdCents: Math.round(liveAmountUsd * 100),
      })
    }

    if (settled) {
      const explorer = extractExplorerDetails(result.metadata.evidenceHeaders)
      const execution = attachSignedReceipt({
        metadata: result.metadata,
        url,
        method,
        serviceId: options?.serviceId ?? preview.service?.serviceId ?? 'unknown-service',
        route: liveRoute,
        amountUsd: liveAmountUsd,
      })
      await recordTreasurySpend({
        agentId: agent.agentId,
        serviceId: options?.serviceId ?? preview.service?.serviceId ?? 'unknown-service',
        route: liveRoute,
        amountUsdCents: Math.round(liveAmountUsd * 100),
      })
      recordXmppEvent({
        agentId: agent.agentId,
        url,
        method,
        serviceId: options?.serviceId ?? preview.service?.serviceId ?? 'unknown-service',
        route: liveRoute,
        status: 'settled',
        amountUsd: liveAmountUsd,
        projectedRequests: options?.projectedRequests ?? 1,
        receiptId: execution?.receiptId ?? result.metadata.receiptId,
        txHash: explorer.txHash,
        explorerUrl: explorer.explorerUrl,
        sessionId: sessionRegistry.get(sessionKey)?.sessionId,
        signedReceipt: execution?.signedReceipt,
        feeSponsored: execution?.feeSponsored,
        feeSponsorPublicKey: execution?.feeSponsorPublicKey,
        settlementStrategy: execution?.settlementStrategy,
        executionNote: execution?.executionNote,
      })
      const metadata: XmppFetchMetadata = {
        route: liveRoute,
        retried: settled,
        execution,
        policy,
        budget: buildBudgetSnapshot({
          agentId: agent.agentId,
          agentProfile: agent,
          url,
          method,
          serviceId: options?.serviceId ?? preview.service?.serviceId,
          route: liveRoute,
          projectedRequests: options?.projectedRequests,
          hasReusableSession: Boolean(existingSession),
        }),
      }
      if (idempotency.idempotencyKey && idempotency.fingerprint) {
        await storeIdempotentResponse(
          idempotency.idempotencyKey,
          idempotency.fingerprint,
          result.response,
          metadata,
        )
      }

      return setMetadata(result.response, metadata)
    }

    if (idempotency.idempotencyKey && idempotency.fingerprint) {
      clearIdempotentReservation(idempotency.idempotencyKey, idempotency.fingerprint)
    }

    return setMetadata(result.response, {
      route: liveRoute,
      retried: settled,
      execution: result.metadata,
      policy,
      budget: buildBudgetSnapshot({
        agentId: agent.agentId,
        agentProfile: agent,
        url,
        method,
        serviceId: options?.serviceId ?? preview.service?.serviceId,
        route: liveRoute,
        projectedRequests: options?.projectedRequests,
        hasReusableSession: Boolean(existingSession),
      }),
    })
  }

  const headers = new Headers(init?.headers)
  const firstResponse = await fetch(url, { ...init, headers })

  if (firstResponse.status !== 402) {
    recordXmppEvent({
      agentId: agent.agentId,
      url,
      method,
      serviceId: options?.serviceId ?? preview.service?.serviceId ?? 'unknown-service',
      route: 'x402',
      status: 'preview',
      amountUsd: 0,
      projectedRequests: options?.projectedRequests ?? 1,
    })
    const metadata: XmppFetchMetadata = {
      route: 'x402',
      retried: false,
      policy,
      budget: buildBudgetSnapshot({
        agentId: agent.agentId,
        agentProfile: agent,
        url,
        method,
        serviceId: options?.serviceId ?? preview.service?.serviceId,
        route: 'x402',
        projectedRequests: options?.projectedRequests,
      }),
    }
    if (idempotency.idempotencyKey && idempotency.fingerprint) {
      await storeIdempotentResponse(
        idempotency.idempotencyKey,
        idempotency.fingerprint,
        firstResponse,
        metadata,
      )
    }
    return setMetadata(firstResponse, metadata)
  }

  const challenge = await parseChallenge(firstResponse)
  if (!challenge) {
    if (idempotency.idempotencyKey && idempotency.fingerprint) {
      clearIdempotentReservation(idempotency.idempotencyKey, idempotency.fingerprint)
    }
    return setMetadata(firstResponse, {
      route: 'x402',
      retried: false,
      policy,
      budget: buildBudgetSnapshot({
        agentId: agent.agentId,
        agentProfile: agent,
        url,
        method,
        serviceId: options?.serviceId ?? preview.service?.serviceId,
        route: 'x402',
        projectedRequests: options?.projectedRequests,
      }),
    })
  }

  if ((options?.maxAutoPayUsd ?? 1) < challenge.amountUsd) {
    if (idempotency.idempotencyKey && idempotency.fingerprint) {
      clearIdempotentReservation(idempotency.idempotencyKey, idempotency.fingerprint)
    }
    return setMetadata(firstResponse, {
      route: 'x402',
      challenge,
      retried: false,
      policy,
      budget: buildBudgetSnapshot({
        agentId: agent.agentId,
        agentProfile: agent,
        url,
        method,
        serviceId: options?.serviceId ?? preview.service?.serviceId,
        route: 'x402',
        projectedRequests: options?.projectedRequests,
      }),
    })
  }

  const sessionKey = `${challenge.service}:${url}`
  const decision = await router.chooseFromChallenge({
    url,
    method,
    serviceId: options?.serviceId,
    projectedRequests: options?.projectedRequests,
    streaming: options?.streaming,
    challenge,
    hasReusableSession: sessionRegistry.has(sessionKey),
  })

  const payment = preparePaymentExecution(challenge, decision.route)
  if (payment.metadata.status === 'missing-config') {
    if (idempotency.idempotencyKey && idempotency.fingerprint) {
      clearIdempotentReservation(idempotency.idempotencyKey, idempotency.fingerprint)
    }
    return setMetadata(firstResponse, {
      route: decision.route,
      challenge,
      retried: false,
      execution: payment.metadata,
      policy,
    })
  }

  const spendPolicy = await evaluateSpendPolicy({
    agent,
    serviceId: challenge.service,
    amountUsd: challenge.amountUsd,
    route: decision.route,
  })
  if (spendPolicy) {
    if (idempotency.idempotencyKey && idempotency.fingerprint) {
      clearIdempotentReservation(idempotency.idempotencyKey, idempotency.fingerprint)
    }
    recordXmppEvent({
      agentId: agent.agentId,
      url,
      method,
      serviceId: challenge.service,
      route: decision.route,
      status: 'denied',
      amountUsd: 0,
      projectedRequests: options?.projectedRequests ?? 1,
      policyCode: spendPolicy.code,
    })
    const denied = new Response(
      JSON.stringify({
        error: 'xMPP spend policy denied automatic payment for this request.',
        policy: spendPolicy,
      }),
      {
        status: 403,
        headers: { 'content-type': 'application/json' },
      },
    )
    return setMetadata(denied, {
      route: decision.route,
      retried: false,
      policy: spendPolicy,
      budget: buildBudgetSnapshot({
        agentId: agent.agentId,
        agentProfile: agent,
        url,
        method,
        serviceId: challenge.service,
        route: decision.route,
        projectedRequests: options?.projectedRequests,
        hasReusableSession: decision.route === 'mpp-session-reuse',
      }),
    })
  }

  const retryHeaders = new Headers(init?.headers)
  for (const [key, value] of Object.entries(payment.headers)) {
    retryHeaders.set(key, value)
  }

  if (decision.route === 'mpp-session-open' || decision.route === 'mpp-session-reuse') {
    const existingSession = sessionRegistry.get(sessionKey)
    const nextSession = {
      sessionId: challenge.sessionId ?? existingSession?.sessionId ?? sessionKey,
      callCount: decision.route === 'mpp-session-open' ? 1 : (existingSession?.callCount ?? 0) + 1,
    }
    sessionRegistry.set(sessionKey, nextSession)
    upsertLocalSession(nextSession.sessionId, challenge.service, nextSession.callCount)
  }

  const retried = await fetch(url, {
    ...init,
    headers: retryHeaders,
  })

  if (retried.status < 400) {
    const currentSession = sessionRegistry.get(sessionKey)
    const execution = attachSignedReceipt({
      metadata: payment.metadata,
      url,
      method,
      serviceId: challenge.service,
      route: decision.route,
      amountUsd: challenge.amountUsd,
    })
    recordXmppEvent({
      agentId: agent.agentId,
      url,
      method,
      serviceId: challenge.service,
      route: decision.route,
      status: 'settled',
      amountUsd: estimateRouteCost({
        route: decision.route,
        url,
        method,
        serviceId: challenge.service,
        projectedRequests: 1,
        hasReusableSession: decision.route === 'mpp-session-reuse',
      }),
      projectedRequests: options?.projectedRequests ?? 1,
      receiptId: execution?.receiptId ?? payment.metadata.receiptId,
      sessionId: currentSession?.sessionId,
      signedReceipt: execution?.signedReceipt,
      feeSponsored: execution?.feeSponsored,
      feeSponsorPublicKey: execution?.feeSponsorPublicKey,
      settlementStrategy: execution?.settlementStrategy,
      executionNote: execution?.executionNote,
    })
    const metadata: XmppFetchMetadata = {
      route: decision.route,
      challenge,
      retried: true,
      execution,
      policy,
      budget: buildBudgetSnapshot({
        agentId: agent.agentId,
        agentProfile: agent,
        url,
        method,
        serviceId: challenge.service,
        route: decision.route,
        projectedRequests: options?.projectedRequests,
        hasReusableSession: decision.route === 'mpp-session-reuse',
      }),
    }
    if (idempotency.idempotencyKey && idempotency.fingerprint) {
      await storeIdempotentResponse(
        idempotency.idempotencyKey,
        idempotency.fingerprint,
        retried,
        metadata,
      )
    }

    return setMetadata(retried, metadata)
  }

  if (idempotency.idempotencyKey && idempotency.fingerprint) {
    clearIdempotentReservation(idempotency.idempotencyKey, idempotency.fingerprint)
  }

  return setMetadata(retried, {
    route: decision.route,
    challenge,
    retried: true,
    execution: payment.metadata,
    policy,
    budget: buildBudgetSnapshot({
      agentId: agent.agentId,
      agentProfile: agent,
      url,
      method,
      serviceId: challenge.service,
      route: decision.route,
      projectedRequests: options?.projectedRequests,
      hasReusableSession: decision.route === 'mpp-session-reuse',
    }),
  })
}
