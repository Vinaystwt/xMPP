import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as paymentAdapters from '@xmpp/payment-adapters'
import { getXmppMetadata, resetXmppRuntimeState, xmppFetch } from './index.js'

describe('xmppFetch', () => {
  beforeEach(() => {
    resetXmppRuntimeState()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    resetXmppRuntimeState()
  })

  it('retries after a 402 payment challenge', async () => {
    process.env.XMPP_PAYMENT_EXECUTION_MODE = 'mock'
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            kind: 'x402',
            service: 'research-api',
            amountUsd: 0.01,
            retryHeaderName: 'x-xmpp-paid',
            retryHeaderValue: 'ok',
          }),
          {
            status: 402,
            headers: { 'content-type': 'application/json' },
          },
        ),
      )
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }))

    const response = await xmppFetch('http://localhost:4101/research?q=stellar')
    const metadata = getXmppMetadata(response)

    expect(response.status).toBe(200)
    expect(metadata?.retried).toBe(true)
    expect(metadata?.execution?.status).toBeDefined()
    expect(metadata?.execution?.status).not.toBe('missing-config')
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('stops before retry when testnet mode is missing secrets', async () => {
    process.env.XMPP_PAYMENT_EXECUTION_MODE = 'testnet'
    delete process.env.XMPP_AGENT_SECRET_KEY
    delete process.env.MPP_SECRET_KEY

    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          kind: 'mpp-charge',
          service: 'market-api',
          amountUsd: 0.03,
          retryHeaderName: 'x-xmpp-paid',
          retryHeaderValue: 'ok',
        }),
        {
          status: 402,
          headers: { 'content-type': 'application/json' },
        },
      ),
    )

    const response = await xmppFetch('http://localhost:4102/quote?symbol=XLM', undefined, {
      serviceId: 'market-api',
    })
    const metadata = getXmppMetadata(response)

    expect(response.status).toBe(424)
    expect(metadata?.retried).toBe(false)
    expect(metadata?.execution?.status).toBe('missing-config')
    expect(metadata?.execution?.missingConfig).toContain('XMPP_AGENT_SECRET_KEY')
    expect(metadata?.execution?.missingConfig).toContain('MPP_SECRET_KEY')
    expect(fetchMock).toHaveBeenCalledTimes(0)
  })

  it('blocks unsafe routes before any network request', async () => {
    process.env.XMPP_PAYMENT_EXECUTION_MODE = 'mock'
    const fetchMock = vi.spyOn(globalThis, 'fetch')

    const response = await xmppFetch('http://localhost:4102/admin/export')
    const metadata = getXmppMetadata(response)
    const body = await response.json()

    expect(response.status).toBe(403)
    expect(body.error).toContain('policy denied')
    expect(metadata?.policy?.allowed).toBe(false)
    expect(metadata?.policy?.code).toBe('blocked-path')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('blocks an agent from spending against a disallowed service', async () => {
    process.env.XMPP_PAYMENT_EXECUTION_MODE = 'mock'
    const fetchMock = vi.spyOn(globalThis, 'fetch')

    const response = await xmppFetch('http://localhost:4102/quote?symbol=XLM', undefined, {
      agentId: 'research-agent',
      serviceId: 'market-api',
      projectedRequests: 1,
    })
    const metadata = getXmppMetadata(response)
    const body = await response.json()

    expect(response.status).toBe(403)
    expect(body.error).toContain('agent policy denied')
    expect(metadata?.policy?.code).toBe('blocked-agent')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('opens then reuses a session in testnet mode and clears it on runtime reset', async () => {
    process.env.XMPP_PAYMENT_EXECUTION_MODE = 'testnet'
    process.env.XMPP_AGENT_SECRET_KEY =
      'SDJ5L6UNCSFK5L2AUIIRVIE7KW4HAZ6N7P2KQ6CUPT5KUG6J6LYW7CLW'
    process.env.MPP_SECRET_KEY =
      'SB5Y5P5ONLTHYBUFSUWPG4KSTC35DEYKM3NOMFEML3A5FC4T5TXV6H3V'
    process.env.MPP_CHANNEL_CONTRACT_ID =
      'CDCMWMSCRL2HR5YZLMFKLWR5DEPTAEOOLKBXYLQ2MK4FBPUOVUP72E3A'

    const executePaymentRoute = vi
      .spyOn(paymentAdapters, 'executePaymentRoute')
      .mockImplementation(async (route) => ({
        response: new Response(JSON.stringify({ ok: true, route }), { status: 200 }),
        metadata: {
          mode: 'testnet',
          status: 'settled-testnet',
          route,
          receiptId: `receipt-${route}`,
        },
      }))

    const input = 'http://localhost:4103/stream/tick'
    const options = {
      agentId: 'market-agent',
      serviceId: 'stream-api',
      projectedRequests: 5,
      streaming: true,
    } as const

    const first = await xmppFetch(input, { method: 'GET' }, options)
    const firstMetadata = getXmppMetadata(first)
    const second = await xmppFetch(input, { method: 'GET' }, options)
    const secondMetadata = getXmppMetadata(second)

    expect(firstMetadata?.route).toBe('mpp-session-open')
    expect(firstMetadata?.execution?.route).toBe('mpp-session-open')
    expect(secondMetadata?.route).toBe('mpp-session-reuse')
    expect(secondMetadata?.execution?.route).toBe('mpp-session-reuse')
    expect(executePaymentRoute.mock.calls.map(([route]) => route)).toEqual([
      'mpp-session-open',
      'mpp-session-reuse',
    ])

    resetXmppRuntimeState()

    const afterReset = await xmppFetch(input, { method: 'GET' }, options)
    const resetMetadata = getXmppMetadata(afterReset)

    expect(resetMetadata?.route).toBe('mpp-session-open')
    expect(resetMetadata?.execution?.route).toBe('mpp-session-open')
  })
})
