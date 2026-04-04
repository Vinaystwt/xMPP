import { config } from '@xmpp/config'
import { Keypair } from '@stellar/stellar-sdk'
import type {
  PaymentExecutionMetadata,
  RouteKind,
  XmppReceiptVerificationResult,
  XmppSignedReceipt,
  XmppSmartAccountExecution,
  XmppWalletInfo,
} from '@xmpp/types'

export const SMART_ACCOUNT_MIN_TRANSACTION_FEE_STROOPS = 2_000_000

function stableReceiptPayload(receipt: Omit<XmppSignedReceipt, 'signature'>) {
  return JSON.stringify({
    receiptId: receipt.receiptId,
    issuedAt: receipt.issuedAt,
    network: receipt.network,
    agent: receipt.agent,
    serviceId: receipt.serviceId,
    url: receipt.url,
    method: receipt.method,
    route: receipt.route,
    amountUsd: receipt.amountUsd,
    txHash: receipt.txHash ?? null,
    explorerUrl: receipt.explorerUrl ?? null,
    paymentReference: receipt.paymentReference ?? null,
  })
}

export function signXmppReceipt(
  input: Omit<XmppSignedReceipt, 'signature' | 'agent' | 'issuedAt' | 'network'> & {
    issuedAt?: string
    network?: string
  },
): XmppSignedReceipt | null {
  if (!config.wallet.agentSecretKey) {
    return null
  }

  const keypair = Keypair.fromSecret(config.wallet.agentSecretKey)
  const receipt: Omit<XmppSignedReceipt, 'signature'> = {
    ...input,
    issuedAt: input.issuedAt ?? new Date().toISOString(),
    network: input.network ?? config.network,
    agent: keypair.publicKey(),
  }
  const payload = Buffer.from(stableReceiptPayload(receipt), 'utf8')
  const signature = keypair.sign(payload).toString('base64')

  return {
    ...receipt,
    signature,
  }
}

export function verifyXmppReceipt(receipt: XmppSignedReceipt): XmppReceiptVerificationResult {
  const keypair = Keypair.fromPublicKey(receipt.agent)
  const payload = Buffer.from(
    stableReceiptPayload({
      receiptId: receipt.receiptId,
      issuedAt: receipt.issuedAt,
      network: receipt.network,
      agent: receipt.agent,
      serviceId: receipt.serviceId,
      url: receipt.url,
      method: receipt.method,
      route: receipt.route,
      amountUsd: receipt.amountUsd,
      txHash: receipt.txHash,
      explorerUrl: receipt.explorerUrl,
      paymentReference: receipt.paymentReference,
    }),
    'utf8',
  )

  return {
    valid: keypair.verify(payload, Buffer.from(receipt.signature, 'base64')),
    agent: receipt.agent,
    receiptId: receipt.receiptId,
  }
}

function smartAccountConfigured() {
  return Boolean(config.wallet.smartAccountContractId)
}

export function getEffectiveSmartAccountFeeCeiling() {
  if (!smartAccountConfigured()) {
    return config.x402.maxTransactionFeeStroops
  }

  return Math.max(config.x402.maxTransactionFeeStroops, SMART_ACCOUNT_MIN_TRANSACTION_FEE_STROOPS)
}

function smartAccountFeeFloorApplied() {
  return smartAccountConfigured() &&
    config.x402.maxTransactionFeeStroops < SMART_ACCOUNT_MIN_TRANSACTION_FEE_STROOPS
}

function getSmartAccountPreflightFailures() {
  if (!smartAccountConfigured()) {
    return ['XMPP_SMART_ACCOUNT_CONTRACT_ID']
  }

  return [
    !config.wallet.agentSecretKey ? 'XMPP_AGENT_SECRET_KEY' : null,
    !config.x402.facilitatorPrivateKey ? 'FACILITATOR_STELLAR_PRIVATE_KEY' : null,
  ].filter((value): value is string => value !== null)
}

function smartAccountPrimaryReady() {
  return Boolean(
    config.wallet.smartAccountContractId &&
      config.wallet.agentSecretKey &&
      config.x402.facilitatorPrivateKey,
  )
}

export function getRouteExecutionPlan(route: RouteKind): {
  settlementStrategy: PaymentExecutionMetadata['settlementStrategy']
  executionNote: string
  smartAccount: XmppSmartAccountExecution
} {
  const configured = smartAccountConfigured()
  const liveReady = smartAccountPrimaryReady()

  if (route === 'x402') {
    if (liveReady) {
      return {
        settlementStrategy: 'smart-account',
        executionNote:
          'x402 prefers the configured smart account, with an automatic fallback to keypair settlement if delegated auth becomes unavailable.',
        smartAccount: {
          configured: true,
          preferred: true,
          supported: true,
          used: true,
          contractId: config.wallet.smartAccountContractId ?? null,
        },
      }
    }

    return {
      settlementStrategy: 'keypair',
      executionNote: configured
        ? 'Smart account is configured, but x402 is staying on the agent keypair until the smart-account demo preconditions are fully satisfied.'
        : 'x402 is executing with the agent keypair.',
      smartAccount: {
        configured,
        preferred: configured,
        supported: true,
        used: false,
        contractId: config.wallet.smartAccountContractId ?? null,
        fallbackReason: configured
          ? 'Smart-account x402 is guarded until the delegated signer, facilitator, and fee-cap preconditions are all ready.'
          : 'No smart account is configured.',
      },
    }
  }

  return {
    settlementStrategy: configured ? 'keypair-fallback' : 'keypair',
    executionNote: configured
      ? 'MPP is using explicit keypair execution because the current MPP SDK requires Keypair signers.'
      : 'MPP is executing with the configured keypair signer.',
    smartAccount: {
      configured,
      preferred: configured,
      supported: false,
      used: false,
      contractId: config.wallet.smartAccountContractId ?? null,
      fallbackReason: configured
        ? 'Current MPP client flows require Keypair signers.'
        : 'No smart account is configured.',
    },
  }
}

export async function getWalletInfo(): Promise<XmppWalletInfo> {
  const agentKeypair = config.wallet.agentSecretKey
    ? Keypair.fromSecret(config.wallet.agentSecretKey)
    : null
  const feeSponsorSecret =
    config.mpp.feeSponsorSecretKey ??
    ((config.mpp.feeSponsorship.chargeEnabled || config.mpp.feeSponsorship.sessionEnabled)
      ? config.mpp.secretKey
      : undefined)
  const feeSponsorKeypair = feeSponsorSecret ? Keypair.fromSecret(feeSponsorSecret) : null
  const feeBumpKeypair = config.mpp.feeBumpSecretKey
    ? Keypair.fromSecret(config.mpp.feeBumpSecretKey)
    : null
  const smartAccountReady = smartAccountConfigured()
  const smartAccountActive = smartAccountPrimaryReady()
  const smartAccountPreflightFailures = getSmartAccountPreflightFailures()
  const smartAccountEffectiveFeeCeiling = getEffectiveSmartAccountFeeCeiling()
  const smartAccountFeeFloorWasApplied = smartAccountFeeFloorApplied()
  const smartAccountMode: XmppWalletInfo['smartAccount']['mode'] = smartAccountActive
    ? 'x402-only'
    : smartAccountReady
      ? 'x402-only'
      : 'inactive'
  const smartAccountRouteCoverage: XmppWalletInfo['smartAccount']['routeCoverage'] = smartAccountReady
    ? 'x402-only'
    : 'inactive'
  const smartAccountOperatorNotes = smartAccountActive
    ? [
        'Smart-account execution is enabled for x402 only.',
        'If delegated x402 settlement becomes unavailable, xMPP falls back to the stable keypair path instead of surfacing a smart-account-specific failure.',
        'MPP charge and session flows still use keypair execution because the current MPP client requires Keypair signers.',
        smartAccountFeeFloorWasApplied
          ? `The facilitator is enforcing a safe x402 fee ceiling of at least ${SMART_ACCOUNT_MIN_TRANSACTION_FEE_STROOPS.toLocaleString()} stroops for smart-account execution.`
          : `The facilitator fee ceiling is set to ${smartAccountEffectiveFeeCeiling.toLocaleString()} stroops for smart-account x402 execution.`,
      ]
    : smartAccountReady
      ? [
          'A smart-account contract id is configured, but x402 is still guarded behind the stable keypair path until all demo preconditions are satisfied.',
          'MPP charge and session flows remain explicit keypair routes.',
        ]
      : ['Smart-account execution is not configured yet.']
  const missingSecrets = [
    !config.wallet.agentSecretKey ? 'XMPP_AGENT_SECRET_KEY' : null,
    !config.x402.facilitatorPrivateKey ? 'FACILITATOR_STELLAR_PRIVATE_KEY' : null,
    !config.mpp.secretKey ? 'MPP_SECRET_KEY' : null,
  ].filter((value): value is string => value !== null)

  return {
    connected: missingSecrets.length === 0,
    paymentExecutionMode: config.paymentExecutionMode,
    network: config.network,
    rpcUrl: config.rpcUrl,
    agentPublicKey: agentKeypair?.publicKey() ?? null,
    settlementStrategy: smartAccountActive
      ? 'smart-account-x402-preferred'
      : smartAccountReady
        ? 'smart-account-partial-fallback'
        : 'keypair-live',
    smartAccount: {
      ready: smartAccountReady,
      mode: smartAccountMode,
      routeCoverage: smartAccountRouteCoverage,
      demoReady: smartAccountActive,
      guardedFallback: smartAccountReady,
      contractId: config.wallet.smartAccountContractId ?? null,
      wasmHash: config.wallet.smartAccountWasmHash,
      webauthnVerifierAddress: config.wallet.webauthnVerifierAddress,
      ed25519VerifierAddress: config.wallet.ed25519VerifierAddress,
      spendingLimitPolicyAddress: config.wallet.spendingLimitPolicyAddress,
      thresholdPolicyAddress: config.wallet.thresholdPolicyAddress,
      preferredRoutes: smartAccountActive ? ['x402'] : [],
      fallbackRoutes: smartAccountReady ? ['mpp-charge', 'mpp-session-open', 'mpp-session-reuse'] : [],
      supportedRoutes: ['x402'],
      unsupportedRoutes: ['mpp-charge', 'mpp-session-open', 'mpp-session-reuse'],
      unsupportedReason: smartAccountReady
        ? 'MPP charge and MPP session routes still require explicit Keypair signers in the current client stack.'
        : null,
      configuredMaxTransactionFeeStroops: config.x402.maxTransactionFeeStroops,
      effectiveMaxTransactionFeeStroops: smartAccountEffectiveFeeCeiling,
      feeFloorApplied: smartAccountFeeFloorWasApplied,
      preflightFailures: smartAccountPreflightFailures,
      coverageMessage: smartAccountReady
        ? 'Smart-account execution is intentionally limited to x402. All MPP routes remain keypair-backed.'
        : 'Smart-account execution is not configured.',
      message: smartAccountActive
        ? 'Smart-account execution is enabled for x402 only, with guarded fallback to the stable keypair path if the delegated route becomes unavailable.'
        : smartAccountReady
          ? 'Smart-account identifiers are configured, but x402 stays on the stable keypair path until the delegated flow is fully demo-ready.'
          : 'Smart account execution is not configured yet.',
      operatorNotes: smartAccountOperatorNotes,
    },
    feeSponsorship: {
      enabled: config.mpp.feeSponsorship.chargeEnabled || config.mpp.feeSponsorship.sessionEnabled,
      available:
        (config.mpp.feeSponsorship.chargeEnabled || config.mpp.feeSponsorship.sessionEnabled) &&
        Boolean(feeSponsorKeypair),
      mppChargeEnabled: config.mpp.feeSponsorship.chargeEnabled,
      mppSessionEnabled: config.mpp.feeSponsorship.sessionEnabled,
      sponsorPublicKey: feeSponsorKeypair?.publicKey() ?? null,
      feeBumpPublicKey: feeBumpKeypair?.publicKey() ?? null,
      message: feeSponsorKeypair
        ? config.mpp.feeSponsorship.chargeEnabled && config.mpp.feeSponsorship.sessionEnabled
          ? 'MPP charge and session services can sponsor gas for agent-side flows.'
          : config.mpp.feeSponsorship.sessionEnabled
            ? 'MPP session services can sponsor gas for agent-side flows; charge stays agent-funded.'
            : config.mpp.feeSponsorship.chargeEnabled
              ? 'MPP charge services can sponsor gas for agent-side flows; sessions stay agent-funded.'
              : 'Fee sponsorship is disabled; the agent pays its own network fees.'
        : 'Fee sponsorship is disabled; the agent pays its own network fees.',
    },
    missingSecrets,
    message:
      missingSecrets.length === 0
        ? 'xMPP has the core Stellar testnet secrets required to continue live payment integration.'
        : 'xMPP is still missing the three core Stellar testnet secrets required for live payment execution.',
  }
}
