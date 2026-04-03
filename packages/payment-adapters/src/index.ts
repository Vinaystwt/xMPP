import { config } from '@xmpp/config'
import { Keypair } from '@stellar/stellar-sdk'
import { basicNodeSigner } from '@stellar/stellar-sdk/contract'
import { Mppx as MppxCharge, stellar as mppCharge } from '@stellar/mpp/charge/client'
import { Mppx as MppxChannel, stellar as mppChannel } from '@stellar/mpp/channel/client'
import { wrapFetchWithPaymentFromConfig } from '@x402/fetch'
import { createEd25519Signer, type ClientStellarSigner } from '@x402/stellar'
import { ExactStellarScheme } from '@x402/stellar/exact/client'
import type {
  PaymentChallenge,
  PaymentExecutionMetadata,
  PaymentExecutionResult,
  PaymentExecutionStatus,
  RouteKind,
} from '@xmpp/types'
import { XLM_SAC_TESTNET } from '@stellar/mpp'
import { getRouteExecutionPlan } from '@xmpp/wallet'

const stellarNetwork = config.network as 'stellar:testnet' | 'stellar:pubnet'
const liveFetchCache = new Map<'x402' | 'mpp-charge' | 'mpp-session', typeof fetch>()

export function buildRetryHeaders(challenge: PaymentChallenge, route: RouteKind) {
  return {
    [challenge.retryHeaderName]: challenge.retryHeaderValue,
    'x-xmpp-route': route,
  }
}

function createReceiptId(route: RouteKind) {
  return `xmpp_${route}_${Date.now().toString(36)}`
}

function requiredConfigForRoute(route: RouteKind) {
  if (route === 'x402') {
    return ['XMPP_AGENT_SECRET_KEY', 'FACILITATOR_STELLAR_PRIVATE_KEY'] as const
  }

  if (route === 'mpp-session-open' || route === 'mpp-session-reuse') {
    return ['XMPP_AGENT_SECRET_KEY', 'MPP_SECRET_KEY', 'MPP_CHANNEL_CONTRACT_ID'] as const
  }

  return ['XMPP_AGENT_SECRET_KEY', 'MPP_SECRET_KEY'] as const
}

function hasEnvVar(name: string) {
  return Boolean(process.env[name]?.trim())
}

function getExecutionStatus(route: RouteKind): {
  mode: 'mock' | 'testnet'
  status: PaymentExecutionStatus
  missingConfig: string[]
} {
  const requestedMode = process.env.XMPP_PAYMENT_EXECUTION_MODE
  const mode =
    requestedMode === 'mock' || requestedMode === 'testnet'
      ? requestedMode
      : config.paymentExecutionMode

  if (mode === 'mock') {
    return {
      mode,
      status: 'mock-paid',
      missingConfig: [],
    }
  }

  const missingConfig = requiredConfigForRoute(route).filter((name) => !hasEnvVar(name))
  return {
    mode,
    status: missingConfig.length === 0 ? 'ready-for-testnet' : 'missing-config',
    missingConfig,
  }
}

export function preparePaymentExecution(
  challenge: PaymentChallenge,
  route: RouteKind,
): {
  headers: Record<string, string>
  metadata: PaymentExecutionMetadata
} {
  const receiptId = createReceiptId(route)
  const { mode, status, missingConfig } = getExecutionStatus(route)
  const executionPlan = getRouteExecutionPlan(route)

  return {
    headers: {
      ...buildRetryHeaders(challenge, route),
      'x-xmpp-receipt': receiptId,
      'x-xmpp-execution-mode': mode,
      'x-xmpp-execution-status': status,
    },
    metadata: {
      mode,
      status,
      route,
      receiptId,
      missingConfig: missingConfig.length > 0 ? missingConfig : undefined,
      settlementStrategy: executionPlan.settlementStrategy,
      executionNote: executionPlan.executionNote,
      smartAccount: executionPlan.smartAccount,
    },
  }
}

function getAgentSecretKey() {
  if (!config.wallet.agentSecretKey) {
    throw new Error('XMPP_AGENT_SECRET_KEY is required for live payment execution.')
  }

  return config.wallet.agentSecretKey
}

function createX402ClientSigner(): ClientStellarSigner {
  const executionPlan = getRouteExecutionPlan('x402')
  if (executionPlan.smartAccount.used && config.wallet.smartAccountContractId) {
    const keypair = Keypair.fromSecret(getAgentSecretKey())
    const signer = basicNodeSigner(keypair, config.networkPassphrase)

    return {
      address: config.wallet.smartAccountContractId,
      signAuthEntry: signer.signAuthEntry,
      signTransaction: signer.signTransaction,
    }
  }

  return createEd25519Signer(getAgentSecretKey(), stellarNetwork)
}

function getLiveFetchForRoute(route: RouteKind) {
  if (route === 'x402') {
    const cached = liveFetchCache.get('x402')
    if (cached) {
      return cached
    }

    const signer = createX402ClientSigner()
    const paidFetch = wrapFetchWithPaymentFromConfig(globalThis.fetch, {
      schemes: [
        {
          network: 'stellar:*',
          client: new ExactStellarScheme(signer, { url: config.rpcUrl }),
        },
      ],
    })
    liveFetchCache.set('x402', paidFetch)
    return paidFetch
  }

  if (route === 'mpp-charge') {
    const cached = liveFetchCache.get('mpp-charge')
    if (cached) {
      return cached
    }

    const mppx = MppxCharge.create({
      methods: [
        mppCharge.charge({
          keypair: Keypair.fromSecret(getAgentSecretKey()),
          rpcUrl: config.rpcUrl,
        }),
      ],
      polyfill: false,
    })

    liveFetchCache.set('mpp-charge', mppx.fetch)
    return mppx.fetch
  }

  const cached = liveFetchCache.get('mpp-session')
  if (cached) {
    return cached
  }

  const agentKeypair = Keypair.fromSecret(getAgentSecretKey())
  const mppx = MppxChannel.create({
    methods: [
      mppChannel.channel({
        commitmentKey: agentKeypair,
        sourceAccount: agentKeypair.publicKey(),
        rpcUrl: config.rpcUrl,
      }),
    ],
    polyfill: false,
  })

  liveFetchCache.set('mpp-session', mppx.fetch)
  return mppx.fetch
}

function createExecutionMetadata(route: RouteKind): PaymentExecutionMetadata {
  const receiptId = createReceiptId(route)
  const { mode, status, missingConfig } = getExecutionStatus(route)
  const executionPlan = getRouteExecutionPlan(route)

  return {
    mode,
    status,
    route,
    receiptId,
    missingConfig: missingConfig.length > 0 ? missingConfig : undefined,
    settlementStrategy: executionPlan.settlementStrategy,
    executionNote: executionPlan.executionNote,
    smartAccount: executionPlan.smartAccount,
  }
}

function extractEvidenceHeaders(headers: Headers): Record<string, string> | undefined {
  const evidenceEntries: Array<[string, string]> = []
  headers.forEach((value, key) => {
    const normalized = key.toLowerCase()
    if (
      normalized.startsWith('x-payment') ||
      normalized.startsWith('x-mpp') ||
      normalized.startsWith('x-xmpp-') ||
      normalized.includes('receipt') ||
      normalized.includes('transaction')
    ) {
      evidenceEntries.push([key, value])
    }
  })

  if (evidenceEntries.length === 0) {
    return undefined
  }

  return Object.fromEntries(evidenceEntries)
}

function getBooleanHeader(headers: Headers, name: string) {
  const value = headers.get(name)
  if (value == null) {
    return undefined
  }

  return value.toLowerCase() === 'true'
}

export async function executePaymentRoute(
  route: RouteKind,
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<PaymentExecutionResult> {
  const metadata = createExecutionMetadata(route)
  if (metadata.status === 'missing-config') {
    return {
      response: new Response(
        JSON.stringify({
          error: 'xMPP live payment execution is not fully configured for this route.',
          route,
          missingConfig: metadata.missingConfig ?? [],
        }),
        {
          status: 424,
          headers: { 'content-type': 'application/json' },
        },
      ),
      metadata,
    }
  }

  if (route === 'mpp-session-open' || route === 'mpp-session-reuse') {
    if (!config.mpp.channelContractId) {
      return {
        response: new Response(
          JSON.stringify({
            error: 'MPP session mode requires a deployed one-way-channel contract.',
            route,
          }),
          {
            status: 424,
            headers: { 'content-type': 'application/json' },
          },
        ),
        metadata: {
          ...metadata,
          status: 'missing-config',
          missingConfig: ['MPP_CHANNEL_CONTRACT_ID'],
        },
      }
    }
  }

  const paidFetch = getLiveFetchForRoute(route)
  const liveHeaders = new Headers(init?.headers)
  liveHeaders.set('x-xmpp-route', route)
  const response = await paidFetch(input, {
    ...init,
    headers: liveHeaders,
  })
  const headers = new Headers(response.headers)
  const evidenceHeaders = extractEvidenceHeaders(headers)
  const finalMetadata: PaymentExecutionMetadata = {
    ...metadata,
    status: response.status === 402 ? metadata.status : 'settled-testnet',
    evidenceHeaders,
    feeSponsored: getBooleanHeader(headers, 'x-xmpp-fee-sponsored'),
    feeSponsorPublicKey: headers.get('x-xmpp-fee-sponsor') ?? undefined,
    feeBumpPublicKey: headers.get('x-xmpp-fee-bump-sponsor') ?? undefined,
  }

  headers.set('x-xmpp-receipt', metadata.receiptId)
  headers.set('x-xmpp-execution-mode', metadata.mode)
  headers.set('x-xmpp-execution-status', finalMetadata.status)
  headers.set('x-xmpp-route', route)
  if (finalMetadata.settlementStrategy) {
    headers.set('x-xmpp-settlement-strategy', finalMetadata.settlementStrategy)
  }
  if (finalMetadata.smartAccount) {
    headers.set('x-xmpp-smart-account-used', String(finalMetadata.smartAccount.used))
    if (finalMetadata.smartAccount.fallbackReason) {
      headers.set('x-xmpp-smart-account-fallback', finalMetadata.smartAccount.fallbackReason)
    }
  }
  if (typeof finalMetadata.feeSponsored === 'boolean') {
    headers.set('x-xmpp-fee-sponsored', String(finalMetadata.feeSponsored))
  }
  if (finalMetadata.feeSponsorPublicKey) {
    headers.set('x-xmpp-fee-sponsor', finalMetadata.feeSponsorPublicKey)
  }
  if (finalMetadata.feeBumpPublicKey) {
    headers.set('x-xmpp-fee-bump-sponsor', finalMetadata.feeBumpPublicKey)
  }

  const body = await response.arrayBuffer()

  return {
    response: new Response(body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    }),
    metadata: finalMetadata,
  }
}

export { XLM_SAC_TESTNET }
