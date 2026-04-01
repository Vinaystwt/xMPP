import { describe, expect, it } from 'vitest'
import { evaluatePolicy, isAllowedDomain } from './index.js'

describe('policy engine', () => {
  it('allows local demo services', () => {
    expect(isAllowedDomain('http://localhost:4101/research?q=stellar')).toBe(true)
    expect(
      evaluatePolicy('http://localhost:4101/research?q=stellar'),
    ).toMatchObject({ allowed: true, code: 'allowed' })
  })

  it('blocks non-local domains', () => {
    expect(isAllowedDomain('https://example.com/paid')).toBe(false)
    expect(evaluatePolicy('https://example.com/paid')).toMatchObject({
      allowed: false,
      code: 'blocked-domain',
    })
  })

  it('blocks unsafe local admin routes', () => {
    expect(evaluatePolicy('http://localhost:4102/admin/export')).toMatchObject({
      allowed: false,
      code: 'blocked-path',
    })
  })
})
