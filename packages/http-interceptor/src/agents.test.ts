import { describe, expect, it } from 'vitest'
import type { XmppAgentProfile, XmppAgentPolicySnapshot } from '@xmpp/types'
import { applyAgentPolicy } from './agents.js'

describe('agent policy merge', () => {
  it('overlays contract-backed budget, routes, services, and methods on the local agent profile', () => {
    const profile: XmppAgentProfile = {
      agentId: 'research-agent',
      displayName: 'Research Agent',
      role: 'research',
      description: 'Local profile',
      dailyBudgetUsd: 0.15,
      allowedServices: ['research-api'],
      preferredRoutes: ['x402'],
      autopayMethods: ['GET'],
      enabled: true,
      policySource: 'local',
    }
    const policy: XmppAgentPolicySnapshot = {
      agentId: 'research-agent',
      enabled: false,
      dailyBudgetUsd: 0.2,
      allowedServices: ['research-api', 'stream-api'],
      preferredRoutes: ['x402', 'mpp-session-reuse'],
      autopayMethods: ['get', 'head'],
      source: 'contract',
    }

    expect(applyAgentPolicy(profile, policy)).toMatchObject({
      enabled: false,
      dailyBudgetUsd: 0.2,
      allowedServices: ['research-api', 'stream-api'],
      preferredRoutes: ['x402', 'mpp-session-reuse'],
      autopayMethods: ['GET', 'HEAD'],
      policySource: 'merged',
    })
  })
})
