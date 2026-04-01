import { afterEach, describe, expect, it, vi } from 'vitest'
import { getXmppMetadata, xmppFetch } from './index.js'

describe('xmppFetch', () => {
  afterEach(() => {
    vi.restoreAllMocks()
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
})
