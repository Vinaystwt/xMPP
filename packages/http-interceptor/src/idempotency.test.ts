import { afterEach, describe, expect, it } from 'vitest'
import {
  buildIdempotentReplay,
  inspectIdempotency,
  resetIdempotencyCache,
  storeIdempotentResponse,
} from './idempotency.js'

describe('idempotency', () => {
  afterEach(() => {
    resetIdempotencyCache()
  })

  it('requires an idempotency key for non-GET payment requests', () => {
    const result = inspectIdempotency('http://localhost:4102/order', 'POST', {
      body: JSON.stringify({ symbol: 'XLM' }),
      headers: { 'content-type': 'application/json' },
    })

    expect(result).toMatchObject({
      allowed: false,
      code: 'missing-key',
    })
  })

  it('replays a previously stored response for the same request fingerprint', async () => {
    const first = inspectIdempotency(
      'http://localhost:4102/order',
      'POST',
      {
        body: JSON.stringify({ symbol: 'XLM' }),
        headers: { 'content-type': 'application/json' },
      },
      {
        idempotencyKey: 'order-1',
      },
    )

    expect(first.allowed).toBe(true)
    if (
      !first.allowed ||
      !('idempotencyKey' in first) ||
      !('fingerprint' in first) ||
      typeof first.idempotencyKey !== 'string' ||
      typeof first.fingerprint !== 'string'
    ) {
      throw new Error('expected idempotency reservation to succeed')
    }

    await storeIdempotentResponse(
      first.idempotencyKey,
      first.fingerprint,
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
      {
        route: 'mpp-charge',
        retried: true,
      },
    )

    const second = inspectIdempotency(
      'http://localhost:4102/order',
      'POST',
      {
        body: JSON.stringify({ symbol: 'XLM' }),
        headers: { 'content-type': 'application/json' },
      },
      {
        idempotencyKey: 'order-1',
      },
    )

    expect(second).toMatchObject({
      allowed: true,
      replay: true,
      idempotencyKey: 'order-1',
    })

    if (!second.allowed || !('response' in second) || !second.response) {
      throw new Error('expected idempotent replay to be available')
    }

    const replay = buildIdempotentReplay(second.response)
    expect(replay?.metadata.idempotentReplay).toBe(true)
  })

  it('rejects idempotency key reuse with a different request body', () => {
    const first = inspectIdempotency(
      'http://localhost:4102/order',
      'POST',
      {
        body: JSON.stringify({ symbol: 'XLM' }),
        headers: { 'content-type': 'application/json' },
      },
      {
        idempotencyKey: 'order-1',
      },
    )

    expect(first.allowed).toBe(true)

    const second = inspectIdempotency(
      'http://localhost:4102/order',
      'POST',
      {
        body: JSON.stringify({ symbol: 'BTC' }),
        headers: { 'content-type': 'application/json' },
      },
      {
        idempotencyKey: 'order-1',
      },
    )

    expect(second).toMatchObject({
      allowed: false,
      code: 'mismatch',
    })
  })
})
