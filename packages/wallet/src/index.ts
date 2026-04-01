import { config } from '@xmpp/config'

export async function getWalletInfo() {
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
    smartAccount: {
      contractId: config.wallet.smartAccountContractId ?? null,
      wasmHash: config.wallet.smartAccountWasmHash,
      webauthnVerifierAddress: config.wallet.webauthnVerifierAddress,
      ed25519VerifierAddress: config.wallet.ed25519VerifierAddress,
      spendingLimitPolicyAddress: config.wallet.spendingLimitPolicyAddress,
      thresholdPolicyAddress: config.wallet.thresholdPolicyAddress,
    },
    missingSecrets,
    message:
      missingSecrets.length === 0
        ? 'xMPP has the core Stellar testnet secrets required to continue live payment integration.'
        : 'xMPP is still missing the three core Stellar testnet secrets required for live payment execution.',
  }
}
