import { createRouter } from '@xmpp/router'
import { executePaymentRoute, preparePaymentExecution } from '@xmpp/payment-adapters'
import { config } from '@xmpp/config'
import { evaluatePolicy } from '@xmpp/policy-engine'
import type { PaymentChallenge, XmppFetchMetadata, XmppFetchOptions } from '@xmpp/types'

const router = createRouter()
const sessionRegistry = new Map<string, string>()

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

export async function xmppFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
  options?: XmppFetchOptions,
) {
  const url = resolveUrl(input)
  const method = init?.method ?? 'GET'
  const policy = evaluatePolicy(url)

  if (!policy.allowed) {
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
    })
  }

  const preview = await router.preview({
    url,
    method,
    serviceId: options?.serviceId,
    projectedRequests: options?.projectedRequests,
    streaming: options?.streaming,
  })

  if (
    (process.env.XMPP_PAYMENT_EXECUTION_MODE ?? config.paymentExecutionMode) === 'testnet'
  ) {
    const liveRoute =
      preview.route === 'mpp-session-open' && sessionRegistry.has(`${options?.serviceId ?? url}:${url}`)
        ? 'mpp-session-reuse'
        : preview.route
    const result = await executePaymentRoute(liveRoute, input, init)
    if (
      result.metadata.status !== 'missing-config' &&
      (liveRoute === 'mpp-session-open' || liveRoute === 'mpp-session-reuse')
    ) {
      sessionRegistry.set(`${options?.serviceId ?? url}:${url}`, 'live-session')
    }

    return setMetadata(result.response, {
      route: liveRoute,
      retried: result.metadata.status !== 'missing-config' && result.response.status !== 402,
      execution: result.metadata,
      policy,
    })
  }

  const headers = new Headers(init?.headers)
  const firstResponse = await fetch(url, { ...init, headers })

  if (firstResponse.status !== 402) {
    return setMetadata(firstResponse, {
      route: 'x402',
      retried: false,
      policy,
    })
  }

  const challenge = await parseChallenge(firstResponse)
  if (!challenge) {
    return setMetadata(firstResponse, {
      route: 'x402',
      retried: false,
      policy,
    })
  }

  if ((options?.maxAutoPayUsd ?? 1) < challenge.amountUsd) {
    return setMetadata(firstResponse, {
      route: 'x402',
      challenge,
      retried: false,
      policy,
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
    return setMetadata(firstResponse, {
      route: decision.route,
      challenge,
      retried: false,
      execution: payment.metadata,
      policy,
    })
  }

  const retryHeaders = new Headers(init?.headers)
  for (const [key, value] of Object.entries(payment.headers)) {
    retryHeaders.set(key, value)
  }

  if (decision.route === 'mpp-session-open' || decision.route === 'mpp-session-reuse') {
    sessionRegistry.set(sessionKey, challenge.sessionId ?? 'session-open')
  }

  const retried = await fetch(url, {
    ...init,
    headers: retryHeaders,
  })

  return setMetadata(retried, {
    route: decision.route,
    challenge,
    retried: true,
    execution: payment.metadata,
    policy,
  })
}
