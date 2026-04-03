import { describe, expect, it } from 'vitest'
import { createRouter, getServiceCatalogEntry } from './index.js'

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
    expect(result.service?.serviceId).toBe('research-api')
    expect(result.breakdown?.[0]?.route).toBe('x402')
  })

  it('prefers mpp charge for market-api single calls', async () => {
    const result = await router.preview({
      url: 'http://localhost:4102/quote?symbol=XLM',
      method: 'GET',
      projectedRequests: 1,
      serviceId: 'market-api',
    })

    expect(result.route).toBe('mpp-charge')
    expect(result.reason.toLowerCase()).toContain('saving')
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
    expect(result.breakdown?.find((item) => item.route === 'mpp-session-open')?.supported).toBe(true)
  })

  it('promotes reusable session when one already exists', async () => {
    const result = router.explain({
      url: 'http://localhost:4103/stream/tick',
      method: 'GET',
      projectedRequests: 5,
      serviceId: 'stream-api',
      streaming: true,
      hasReusableSession: true,
    })

    expect(result.route).toBe('mpp-session-reuse')
  })

  it('estimates a mixed workflow against naive x402 spend', () => {
    const estimate = router.estimateWorkflow([
      {
        url: 'http://localhost:4101/research?q=stellar',
        serviceId: 'research-api',
        projectedRequests: 1,
      },
      {
        url: 'http://localhost:4102/quote?symbol=XLM',
        serviceId: 'market-api',
        projectedRequests: 1,
      },
      {
        url: 'http://localhost:4103/stream/tick',
        serviceId: 'stream-api',
        projectedRequests: 5,
        streaming: true,
      },
    ])

    expect(estimate.breakdown).toHaveLength(3)
    expect(estimate.totalEstimatedCostUsd).toBeGreaterThan(0)
    expect(estimate.savingsVsNaiveUsd).toBeGreaterThanOrEqual(0)
  })

  it('exposes catalog entries for docs and operator views', () => {
    const entry = getServiceCatalogEntry('market-api')

    expect(entry?.displayName).toBe('Market API')
    expect(entry?.capabilities.mppCharge).toBe(true)
  })
})
