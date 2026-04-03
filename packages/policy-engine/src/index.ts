import { getPolicyRuntimeSnapshot } from '@xmpp/contract-runtime'
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
    source: 'local',
  }
}

export async function evaluatePolicyForRequest(input: {
  url: string
  method?: string
  serviceId?: string
}): Promise<PolicyDecision> {
  const localDecision = evaluatePolicy(input.url)
  if (!localDecision.allowed) {
    return localDecision
  }

  const runtime = await getPolicyRuntimeSnapshot(input.serviceId)
  if (runtime.pauseFlag) {
    return {
      allowed: false,
      reason: 'xMPP policy contract is paused for automatic payment execution.',
      code: 'paused',
      source: runtime.source,
    }
  }

  const method = (input.method ?? 'GET').toUpperCase()
  if (method !== 'GET' && input.serviceId == null) {
    return {
      allowed: false,
      reason: 'xMPP requires an explicit service id before automatic payment can proceed on non-GET requests.',
      code: 'blocked-service',
      source: runtime.source,
    }
  }

  if (method !== 'GET' && runtime.globalPolicy == null) {
    return {
      allowed: false,
      reason: 'xMPP blocks automatic payment on non-GET routes unless policy explicitly enables it.',
      code: 'blocked-method',
      source: runtime.source,
    }
  }

  if (method !== 'GET' && runtime.globalPolicy && !runtime.globalPolicy.allowPostAutopay) {
    return {
      allowed: false,
      reason: 'xMPP policy blocks automatic payment on non-GET routes unless explicitly enabled.',
      code: 'blocked-method',
      source: runtime.source,
    }
  }

  if (input.serviceId == null && runtime.globalPolicy && !runtime.globalPolicy.allowUnknownServices) {
    return {
      allowed: false,
      reason: 'xMPP policy requires a known service id before automatic payment can proceed.',
      code: 'blocked-service',
      source: runtime.source,
    }
  }

  if (runtime.servicePolicy && !runtime.servicePolicy.enabled) {
    return {
      allowed: false,
      reason: 'xMPP service policy disabled automatic payment for this service.',
      code: 'blocked-service',
      source: runtime.source,
    }
  }

  return {
    ...localDecision,
    source: runtime.source,
  }
}
