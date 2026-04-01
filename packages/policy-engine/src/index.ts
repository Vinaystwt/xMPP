import type { PolicyDecision } from '@xmpp/types'

const allowedHosts = new Set(['localhost', '127.0.0.1'])
const blockedPathPrefixes = ['/admin', '/internal', '/unsafe']

export function isAllowedDomain(url: string) {
  const parsed = new URL(url)
  return allowedHosts.has(parsed.hostname)
}

export function evaluatePolicy(url: string): PolicyDecision {
  const parsed = new URL(url)

  if (!allowedHosts.has(parsed.hostname)) {
    return {
      allowed: false,
      reason: 'xMPP policy allows automatic payment only to approved local demo hosts.',
      code: 'blocked-domain',
    }
  }

  if (blockedPathPrefixes.some((prefix) => parsed.pathname.startsWith(prefix))) {
    return {
      allowed: false,
      reason: 'xMPP policy blocks sensitive admin or unsafe routes from automatic payment.',
      code: 'blocked-path',
    }
  }

  return {
    allowed: true,
    reason: 'xMPP policy approved this request for automatic payment routing.',
    code: 'allowed',
  }
}
