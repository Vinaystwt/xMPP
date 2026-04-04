import { afterEach, describe, expect, it, vi } from 'vitest'
import { Keypair } from '@stellar/stellar-sdk'
import type { XmppSignedReceipt } from '@xmpp/types'

async function loadWalletModule(
  secret?: string,
  smartAccountContractId?: string,
  maxTransactionFeeStroops = 2_000_000,
) {
  vi.resetModules()
  vi.doMock('@xmpp/config', () => ({
    config: {
      paymentExecutionMode: 'testnet',
      rpcUrl: 'https://soroban-testnet.stellar.org',
      network: 'stellar:testnet',
      x402: {
        facilitatorPrivateKey: 'SFACILITATOR',
        maxTransactionFeeStroops,
      },
      mpp: {
        secretKey: undefined,
        feeSponsorSecretKey: undefined,
        feeBumpSecretKey: undefined,
        feeSponsorship: {
          chargeEnabled: false,
          sessionEnabled: false,
        },
      },
      wallet: {
        agentSecretKey: secret,
        smartAccountContractId,
        smartAccountWasmHash: 'wasm-hash',
        webauthnVerifierAddress: 'CWEBAUTHN',
        ed25519VerifierAddress: 'CED25519',
        spendingLimitPolicyAddress: 'CSPEND',
        thresholdPolicyAddress: 'CTHRESH',
      },
    },
  }))
  return import('./index.js')
}

describe('wallet receipt signing', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.resetModules()
  })

  it('signs and verifies an xMPP receipt', async () => {
    const secret = Keypair.random().secret()
    const { signXmppReceipt, verifyXmppReceipt } = await loadWalletModule(secret)

    const receipt = signXmppReceipt({
      receiptId: 'xmpp_x402_test',
      serviceId: 'research-api',
      url: 'http://localhost:4101/research?q=stellar',
      method: 'GET',
      route: 'x402',
      amountUsd: 0.01,
      txHash: 'abc123',
      explorerUrl: 'https://stellar.expert/explorer/testnet/tx/abc123',
      paymentReference: 'abc123',
      issuedAt: '2026-04-03T00:00:00.000Z',
      network: 'stellar:testnet',
    })

    expect(receipt).not.toBeNull()
    expect(receipt?.agent).toBe(Keypair.fromSecret(secret).publicKey())
    expect(verifyXmppReceipt(receipt as XmppSignedReceipt)).toMatchObject({
      valid: true,
      receiptId: 'xmpp_x402_test',
    })
  })

  it('returns null when the agent key is unavailable', async () => {
    const { signXmppReceipt } = await loadWalletModule(undefined)

    expect(
      signXmppReceipt({
        receiptId: 'xmpp_x402_test',
        serviceId: 'research-api',
        url: 'http://localhost:4101/research?q=stellar',
        method: 'GET',
        route: 'x402',
        amountUsd: 0.01,
      }),
    ).toBeNull()
  })

  it('prefers smart-account execution for x402 when configured', async () => {
    const secret = Keypair.random().secret()
    const { getRouteExecutionPlan, getWalletInfo } = await loadWalletModule(secret, 'CSMARTACCOUNT')

    expect(getRouteExecutionPlan('x402')).toMatchObject({
      settlementStrategy: 'smart-account',
      smartAccount: {
        configured: true,
        supported: true,
        used: true,
      },
    })
    expect(getRouteExecutionPlan('mpp-charge')).toMatchObject({
      settlementStrategy: 'keypair-fallback',
      smartAccount: {
        configured: true,
        supported: false,
        used: false,
      },
    })

    await expect(getWalletInfo()).resolves.toMatchObject({
      settlementStrategy: 'smart-account-x402-preferred',
      smartAccount: {
        ready: true,
        mode: 'x402-only',
        routeCoverage: 'x402-only',
        demoReady: true,
        guardedFallback: true,
        preferredRoutes: ['x402'],
        fallbackRoutes: ['mpp-charge', 'mpp-session-open', 'mpp-session-reuse'],
        supportedRoutes: ['x402'],
        unsupportedRoutes: ['mpp-charge', 'mpp-session-open', 'mpp-session-reuse'],
        unsupportedReason:
          'MPP charge and MPP session routes still require explicit Keypair signers in the current client stack.',
        feeFloorApplied: false,
        preflightFailures: [],
      },
    })
  })

  it('exposes honest smart-account fallback messaging when only the contract id is configured', async () => {
    const { getWalletInfo } = await loadWalletModule(undefined, 'CSMARTACCOUNT')

    await expect(getWalletInfo()).resolves.toMatchObject({
      settlementStrategy: 'smart-account-partial-fallback',
      smartAccount: {
        ready: true,
        mode: 'x402-only',
        routeCoverage: 'x402-only',
        demoReady: false,
        guardedFallback: true,
        preflightFailures: ['XMPP_AGENT_SECRET_KEY'],
        message:
          'Smart-account identifiers are configured, but x402 stays on the stable keypair path until the delegated flow is fully demo-ready.',
      },
    })
  })

  it('enforces the smart-account fee floor in readiness output', async () => {
    const secret = Keypair.random().secret()
    const { getWalletInfo, getEffectiveSmartAccountFeeCeiling } = await loadWalletModule(
      secret,
      'CSMARTACCOUNT',
      500_000,
    )

    expect(getEffectiveSmartAccountFeeCeiling()).toBe(2_000_000)
    await expect(getWalletInfo()).resolves.toMatchObject({
      smartAccount: {
        demoReady: true,
        feeFloorApplied: true,
        configuredMaxTransactionFeeStroops: 500_000,
        effectiveMaxTransactionFeeStroops: 2_000_000,
      },
    })
  })
})
