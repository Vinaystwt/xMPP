import { describe, expect, it, vi } from 'vitest'
import { XmppGatewayClient } from './gateway-client.js'

describe('XmppGatewayClient', () => {
  it('posts fetch payloads through the gateway', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ status: 200, body: { ok: true } }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    )

    const client = new XmppGatewayClient({
      baseUrl: 'http://localhost:4300/',
      fetch: fetchMock as typeof fetch,
    })

    const result = await client.fetch('http://localhost:4101/research?q=stellar', {
      agentId: 'research-agent',
      serviceId: 'research-api',
      projectedRequests: 1,
    })

    expect(result.status).toBe(200)
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:4300/fetch',
      expect.objectContaining({
        method: 'POST',
      }),
    )
  })

  it('builds preview query params correctly', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ policy: { allowed: true }, routePreview: { route: 'x402' } }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    )

    const client = new XmppGatewayClient({
      baseUrl: 'http://localhost:4300',
      fetch: fetchMock as typeof fetch,
    })

    await client.policyPreview({
      url: 'http://localhost:4101/research?q=stellar',
      serviceId: 'research-api',
      projectedRequests: 3,
      streaming: false,
    })

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:4300/policy/preview?url=http%3A%2F%2Flocalhost%3A4101%2Fresearch%3Fq%3Dstellar&method=GET&serviceId=research-api&projectedRequests=3&streaming=false',
      expect.any(Object),
    )
  })
})
