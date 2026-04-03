import { afterEach, describe, expect, it, vi } from 'vitest'
import { Keypair } from '@stellar/stellar-sdk'
import type { XmppSignedReceipt } from '@xmpp/types'

async function loadWalletModule(secret?: string, smartAccountContractId?: string) {
  vi.resetModules()
  vi.doMock('@xmpp/config', () => ({
    config: {
      network: 'stellar:testnet',
      wallet: {
        agentSecretKey: secret,
        smartAccountContractId,
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
    const { getRouteExecutionPlan } = await loadWalletModule(secret, 'CSMARTACCOUNT')

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
  })
})
