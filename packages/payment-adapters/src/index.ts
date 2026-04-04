import { config } from '@xmpp/config'
import * as StellarSdk from '@stellar/stellar-sdk'
import { contract, hash, Keypair, nativeToScVal, rpc, TransactionBuilder, xdr } from '@stellar/stellar-sdk'
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
const liveFetchCache = new Map<
  'x402-smart-account' | 'x402-keypair' | 'mpp-charge' | 'mpp-session',
  typeof fetch
>()
const DEFAULT_LEDGER_CLOSE_SECONDS = 5
const SMART_ACCOUNT_X402_RETRY_DELAY_MS = 1500

function createClassicSignatureScVal(keypair: Keypair, payload: Buffer) {
  return xdr.ScVal.scvVec([
    xdr.ScVal.scvMap([
      new xdr.ScMapEntry({
        key: xdr.ScVal.scvSymbol('public_key'),
        val: xdr.ScVal.scvBytes(keypair.rawPublicKey()),
      }),
      new xdr.ScMapEntry({
        key: xdr.ScVal.scvSymbol('signature'),
        val: xdr.ScVal.scvBytes(keypair.sign(payload)),
      }),
    ]),
  ])
}

function createDelegatedSignerScVal(publicKey: string) {
  return xdr.ScVal.scvVec([
    xdr.ScVal.scvSymbol('Delegated'),
    xdr.ScVal.scvAddress(StellarSdk.Address.fromString(publicKey).toScAddress()),
  ])
}

function createDelegatedAuthPayload(publicKey: string, contextRuleIds: number[]) {
  return xdr.ScVal.scvMap([
    new xdr.ScMapEntry({
      key: xdr.ScVal.scvSymbol('context_rule_ids'),
      val: xdr.ScVal.scvVec(contextRuleIds.map((id) => xdr.ScVal.scvU32(id))),
    }),
    new xdr.ScMapEntry({
      key: xdr.ScVal.scvSymbol('signers'),
      val: xdr.ScVal.scvMap([
        new xdr.ScMapEntry({
          key: createDelegatedSignerScVal(publicKey),
          val: xdr.ScVal.scvBytes(Buffer.alloc(0)),
        }),
      ]),
    }),
  ])
}

function buildSmartAccountSignaturePayload(
  entry: xdr.SorobanAuthorizationEntry,
  networkPassphrase: string,
) {
  const credentials = entry.credentials().address()
  return hash(
    xdr.HashIdPreimage.envelopeTypeSorobanAuthorization(
      new xdr.HashIdPreimageSorobanAuthorization({
        networkId: hash(Buffer.from(networkPassphrase)),
        nonce: credentials.nonce(),
        invocation: entry.rootInvocation(),
        signatureExpirationLedger: credentials.signatureExpirationLedger(),
      }),
    ).toXDR(),
  )
}

function buildSmartAccountAuthDigest(signaturePayload: Buffer, contextRuleIds: number[]) {
  const contextRuleIdsXdr = xdr.ScVal.scvVec(contextRuleIds.map((id) => xdr.ScVal.scvU32(id))).toXDR()
  return hash(Buffer.concat([signaturePayload, contextRuleIdsXdr]))
}

function signDelegatedSmartAccountAuth(
  authEntries: xdr.SorobanAuthorizationEntry[],
  smartAccountContractId: string,
  delegatedSigner: Keypair,
  expiration: number,
  networkPassphrase: string,
  contextRuleIds: number[] = [0],
) {
  const signedAuthEntries: xdr.SorobanAuthorizationEntry[] = []

  for (const entry of authEntries) {
    const credentials = entry.credentials()
    if (credentials.switch().name !== 'sorobanCredentialsAddress') {
      signedAuthEntries.push(entry)
      continue
    }

    const authAddress = StellarSdk.Address.fromScAddress(credentials.address().address()).toString()
    if (authAddress !== smartAccountContractId) {
      signedAuthEntries.push(entry)
      continue
    }

    const smartAccountEntry = xdr.SorobanAuthorizationEntry.fromXDR(entry.toXDR())
    smartAccountEntry.credentials().address().signatureExpirationLedger(expiration)
    const authPayload = createDelegatedAuthPayload(delegatedSigner.publicKey(), contextRuleIds)
    smartAccountEntry
      .credentials()
      .address()
      .signature(authPayload)
    signedAuthEntries.push(smartAccountEntry)
    const signaturePayload = buildSmartAccountSignaturePayload(smartAccountEntry, networkPassphrase)
    const authDigest = buildSmartAccountAuthDigest(signaturePayload, contextRuleIds)

    const delegatedNonce = xdr.Int64.fromString(Date.now().toString())
    const delegatedInvocation = new xdr.SorobanAuthorizedInvocation({
      function: xdr.SorobanAuthorizedFunction.sorobanAuthorizedFunctionTypeContractFn(
        new xdr.InvokeContractArgs({
          contractAddress: StellarSdk.Address.fromString(smartAccountContractId).toScAddress(),
          functionName: '__check_auth',
          args: [xdr.ScVal.scvBytes(authDigest)],
        }),
      ),
      subInvocations: [],
    })

    const delegatedPreimage = xdr.HashIdPreimage.envelopeTypeSorobanAuthorization(
      new xdr.HashIdPreimageSorobanAuthorization({
        networkId: hash(Buffer.from(networkPassphrase)),
        nonce: delegatedNonce,
        signatureExpirationLedger: expiration,
        invocation: delegatedInvocation,
      }),
    )

    signedAuthEntries.push(
      new xdr.SorobanAuthorizationEntry({
        credentials: xdr.SorobanCredentials.sorobanCredentialsAddress(
          new xdr.SorobanAddressCredentials({
            address: StellarSdk.Address.fromString(delegatedSigner.publicKey()).toScAddress(),
            nonce: delegatedNonce,
            signatureExpirationLedger: expiration,
            signature: createClassicSignatureScVal(
              delegatedSigner,
              hash(delegatedPreimage.toXDR()),
            ),
          }),
        ),
        rootInvocation: delegatedInvocation,
      }),
    )
  }

  return signedAuthEntries
}

export const __smartAccountTestUtils = {
  createClassicSignatureScVal,
  createDelegatedSignerScVal,
  createDelegatedAuthPayload,
  buildSmartAccountSignaturePayload,
  buildSmartAccountAuthDigest,
  signDelegatedSmartAccountAuth,
}

class SmartAccountExactStellarScheme {
  scheme = 'exact' as const

  constructor(
    private readonly smartAccountContractId: string,
    private readonly delegatedSigner: Keypair,
  ) {}

  async createPaymentPayload(
    x402Version: number,
    paymentRequirements: {
      scheme: string
      network: string
      payTo: string
      asset: string
      amount: string
      maxTimeoutSeconds: number
      extra: { areFeesSponsored?: boolean }
    },
  ) {
    const { scheme, network, payTo, asset, amount, maxTimeoutSeconds, extra } = paymentRequirements

    if (scheme !== 'exact') {
      throw new Error(`Unsupported Stellar payment scheme: ${scheme}`)
    }

    if (network !== stellarNetwork) {
      throw new Error(`Unsupported Stellar network for smart-account exact payments: ${network}`)
    }

    if (!extra.areFeesSponsored) {
      throw new Error('Exact scheme requires areFeesSponsored to be true')
    }

    const rpcServer = new rpc.Server(config.rpcUrl)
    const latestLedger = await rpcServer.getLatestLedger()
    const maxLedger =
      latestLedger.sequence + Math.ceil(maxTimeoutSeconds / DEFAULT_LEDGER_CLOSE_SECONDS)

    const tx = await contract.AssembledTransaction.build({
      contractId: asset,
      method: 'transfer',
      args: [
        nativeToScVal(this.smartAccountContractId, { type: 'address' }),
        nativeToScVal(payTo, { type: 'address' }),
        nativeToScVal(amount, { type: 'i128' }),
      ],
      networkPassphrase: config.networkPassphrase,
      rpcUrl: config.rpcUrl,
      parseResultXdr: (result) => result,
    })

    this.ensureSimulationSucceeded(tx.simulation)

    const missingSigners = tx.needsNonInvokerSigningBy()
    if (!missingSigners.includes(this.smartAccountContractId) || missingSigners.length > 1) {
      throw new Error(
        `Expected to sign with [${this.smartAccountContractId}], but got [${missingSigners.join(', ')}]`,
      )
    }

    const builtTx = tx.built as any
    const operationXdr = builtTx?._tx.operations()[0]
    if (!operationXdr) {
      throw new Error('Expected an invokeHostFunction operation for smart-account exact payments.')
    }

    const signedAuthEntries = signDelegatedSmartAccountAuth(
      operationXdr.body().invokeHostFunctionOp().auth() ?? [],
      this.smartAccountContractId,
      this.delegatedSigner,
      maxLedger,
      config.networkPassphrase,
    )
    const signedOperationXdr = xdr.Operation.fromXDR(operationXdr.toXDR())
    signedOperationXdr.body().invokeHostFunctionOp().auth(signedAuthEntries)

    const signedBuilder = TransactionBuilder.cloneFrom(builtTx, {
      networkPassphrase: config.networkPassphrase,
    } as any)
    signedBuilder.clearOperations()
    signedBuilder.addOperation(signedOperationXdr)
    const signedTx = signedBuilder.build()

    const resimulation = await rpcServer.simulateTransaction(signedTx)
    this.ensureSimulationSucceeded(resimulation)
    const preparedTx = rpc.assembleTransaction(signedTx, resimulation).build()

    return {
      x402Version,
      payload: {
        transaction: preparedTx.toXDR(),
      },
    }
  }

  private ensureSimulationSucceeded(simulation: any) {
    if (!simulation) {
      throw new Error('Simulation result is undefined')
    }

    if (rpc.Api.isSimulationRestore(simulation)) {
      throw new Error(`Stellar simulation requested restore: ${simulation.restorePreamble}`)
    }

    if (rpc.Api.isSimulationError(simulation)) {
      throw new Error(
        `Stellar simulation failed${simulation.error ? ` with error message: ${simulation.error}` : ''}`,
      )
    }
  }
}

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

function createX402ClientSigner(preferSmartAccount: boolean): ClientStellarSigner {
  if (preferSmartAccount && config.wallet.smartAccountContractId) {
    const keypair = Keypair.fromSecret(getAgentSecretKey())
    const signer = basicNodeSigner(keypair, config.networkPassphrase)

    return {
      address: config.wallet.smartAccountContractId,
      signAuthEntry: async (authEntry) => ({
        signedAuthEntry: keypair.sign(hash(Buffer.from(authEntry, 'base64'))).toString('base64'),
        signerAddress: config.wallet.smartAccountContractId as string,
      }),
      signTransaction: signer.signTransaction,
    }
  }

  return createEd25519Signer(getAgentSecretKey(), stellarNetwork)
}

function createX402Scheme(preferSmartAccount: boolean) {
  if (preferSmartAccount && config.wallet.smartAccountContractId) {
    return new SmartAccountExactStellarScheme(
      config.wallet.smartAccountContractId,
      Keypair.fromSecret(getAgentSecretKey()),
    )
  }

  return new ExactStellarScheme(createX402ClientSigner(false), { url: config.rpcUrl })
}

function getLiveFetchForRoute(route: RouteKind, options?: { preferSmartAccount?: boolean }) {
  if (route === 'x402') {
    const cacheKey =
      options?.preferSmartAccount === false ? 'x402-keypair' : 'x402-smart-account'
    const cached = liveFetchCache.get(cacheKey)
    if (cached) {
      return cached
    }

    const paidFetch = wrapFetchWithPaymentFromConfig(globalThis.fetch, {
      schemes: [
        {
          network: 'stellar:*',
          client: createX402Scheme(options?.preferSmartAccount !== false),
        },
      ],
    })
    liveFetchCache.set(cacheKey, paidFetch)
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

function createSmartAccountFallbackMetadata(
  metadata: PaymentExecutionMetadata,
  error: unknown,
): PaymentExecutionMetadata {
  const fallbackReason =
    error instanceof Error && error.message
      ? `Smart-account x402 failed and xMPP fell back to keypair settlement: ${error.message}`
      : 'Smart-account x402 failed and xMPP fell back to keypair settlement.'

  return {
    ...metadata,
    settlementStrategy: 'keypair-fallback',
    executionNote:
      'x402 automatically fell back to the stable keypair path after a smart-account execution failure.',
    smartAccount: metadata.smartAccount
      ? {
          ...metadata.smartAccount,
          used: false,
          fallbackReason,
        }
      : undefined,
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
      normalized === 'payment-response' ||
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

async function retrySmartAccountX402Fetch(
  input: RequestInfo | URL,
  init: RequestInit | undefined,
  paidFetch: typeof fetch,
) {
  await new Promise((resolve) => setTimeout(resolve, SMART_ACCOUNT_X402_RETRY_DELAY_MS))
  return paidFetch(input, init)
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
  const liveInit = {
    ...init,
    headers: liveHeaders,
  }
  let response: Response
  let finalMetadata = metadata

  try {
    response = await paidFetch(input, liveInit)
  } catch (error) {
    if (route !== 'x402' || !metadata.smartAccount?.used) {
      throw error
    }

    try {
      response = await retrySmartAccountX402Fetch(input, liveInit, paidFetch)
    } catch {
      finalMetadata = createSmartAccountFallbackMetadata(metadata, error)
      response = await getLiveFetchForRoute('x402', { preferSmartAccount: false })(input, liveInit)
    }
  }

  if (route === 'x402' && metadata.smartAccount?.used && response.status === 402) {
    const retryResponse = await retrySmartAccountX402Fetch(input, liveInit, paidFetch)
    if (retryResponse.status !== 402) {
      response = retryResponse
    } else {
      finalMetadata = createSmartAccountFallbackMetadata(
        metadata,
        new Error('Smart-account x402 returned an unresolved 402 challenge.'),
      )
      response = await getLiveFetchForRoute('x402', { preferSmartAccount: false })(input, liveInit)
    }
  }

  const headers = new Headers(response.headers)
  const evidenceHeaders = extractEvidenceHeaders(headers)
  finalMetadata = {
    ...finalMetadata,
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
