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

function smartAccountLiveReady() {
  return Boolean(config.wallet.smartAccountContractId && config.wallet.agentSecretKey)
}

export function getRouteExecutionPlan(route: RouteKind): {
  settlementStrategy: PaymentExecutionMetadata['settlementStrategy']
  executionNote: string
  smartAccount: XmppSmartAccountExecution
} {
  const configured = smartAccountConfigured()
  const liveReady = smartAccountLiveReady()

  if (route === 'x402') {
    if (liveReady) {
      return {
        settlementStrategy: 'smart-account',
        executionNote:
          'x402 prefers the configured smart account as the client payment address and uses the delegated agent signer for auth entry signing.',
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
        ? 'Smart account is configured but x402 is falling back to the agent keypair until delegated signing is fully ready.'
        : 'x402 is executing with the agent keypair.',
      smartAccount: {
        configured,
        preferred: configured,
        supported: true,
        used: false,
        contractId: config.wallet.smartAccountContractId ?? null,
        fallbackReason: configured
          ? 'Smart-account execution preconditions are incomplete, so x402 falls back to keypair signing.'
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
  const smartAccountActive = smartAccountLiveReady()
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
        ? 'smart-account-ready'
        : 'keypair-live',
    smartAccount: {
      ready: smartAccountReady,
      contractId: config.wallet.smartAccountContractId ?? null,
      wasmHash: config.wallet.smartAccountWasmHash,
      webauthnVerifierAddress: config.wallet.webauthnVerifierAddress,
      ed25519VerifierAddress: config.wallet.ed25519VerifierAddress,
      spendingLimitPolicyAddress: config.wallet.spendingLimitPolicyAddress,
      thresholdPolicyAddress: config.wallet.thresholdPolicyAddress,
      preferredRoutes: smartAccountActive ? ['x402'] : [],
      fallbackRoutes: smartAccountReady ? ['mpp-charge', 'mpp-session-open', 'mpp-session-reuse'] : [],
      message: smartAccountActive
        ? 'x402 can prefer the smart account path; MPP routes still fall back to keypair execution.'
        : smartAccountReady
          ? 'Smart account identifiers are configured, but x402 still falls back to keypair execution until delegated signing is fully ready.'
          : 'Smart account execution is not configured yet.',
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
