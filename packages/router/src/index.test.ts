import { describe, expect, it } from 'vitest'
import { createRouter } from './index.js'

describe('router', () => {
  const router = createRouter()

  it('prefers x402 for low-volume calls', async () => {
    const result = await router.preview({
      url: 'http://localhost:4101/research?q=stellar',
      method: 'GET',
      projectedRequests: 1,
      serviceId: 'research-api',
    })

    expect(result.route).toBe('x402')
  })

  it('prefers mpp charge for market-api single calls', async () => {
    const result = await router.preview({
      url: 'http://localhost:4102/quote?symbol=XLM',
      method: 'GET',
      projectedRequests: 1,
      serviceId: 'market-api',
    })

    expect(result.route).toBe('mpp-charge')
  })

  it('prefers mpp session for repeated calls', async () => {
    const result = await router.preview({
      url: 'http://localhost:4103/stream/tick',
      method: 'GET',
      projectedRequests: 5,
      serviceId: 'stream-api',
      streaming: true,
    })

    expect(result.route).toBe('mpp-session-open')
  })
})
