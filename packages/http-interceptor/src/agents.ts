import { config } from '@xmpp/config'
import type { RouteKind, XmppAgentPolicySnapshot, XmppAgentProfile } from '@xmpp/types'

const ALL_ROUTES: RouteKind[] = ['x402', 'mpp-charge', 'mpp-session-open', 'mpp-session-reuse']
const ROUTE_SET = new Set<RouteKind>(ALL_ROUTES)

function roundUsd(value: number) {
  return Math.round(value * 1000) / 1000
}

function normalizeRoutes(routes: string[]) {
  return routes.filter((route): route is RouteKind => ROUTE_SET.has(route as RouteKind))
}

function normalizeAutopayMethods(methods: string[]) {
  return [...new Set(methods.map((method) => method.toUpperCase()))]
}

function buildAgentProfiles(): XmppAgentProfile[] {
  const researchBudget = roundUsd(config.dailyBudgetUsd * 0.3)
  const marketBudget = roundUsd(config.dailyBudgetUsd * 0.7)

  return [
    {
      agentId: 'shared-treasury',
      displayName: 'Shared Treasury',
      role: 'shared',
      description: 'Default unrestricted orchestrator agent backed by the common wallet.',
      dailyBudgetUsd: roundUsd(config.dailyBudgetUsd),
      allowedServices: ['research-api', 'market-api', 'stream-api'],
      preferredRoutes: ALL_ROUTES,
      autopayMethods: ['GET', 'HEAD'],
      enabled: true,
      policySource: 'local',
    },
    {
      agentId: 'research-agent',
      displayName: 'Research Agent',
      role: 'research',
      description: 'Low-risk research worker limited to exact x402 calls on the research API.',
      dailyBudgetUsd: researchBudget,
      allowedServices: ['research-api'],
      preferredRoutes: ['x402'],
      autopayMethods: ['GET'],
      enabled: true,
      policySource: 'local',
    },
    {
      agentId: 'market-agent',
      displayName: 'Market Agent',
      role: 'market',
      description:
        'Higher-ceiling market worker optimized for premium quotes and reusable session flows.',
      dailyBudgetUsd: marketBudget,
      allowedServices: ['market-api', 'stream-api'],
      preferredRoutes: ['mpp-charge', 'mpp-session-open', 'mpp-session-reuse'],
      autopayMethods: ['GET'],
      enabled: true,
      policySource: 'local',
    },
  ]
}

export function listXmppAgentProfiles() {
  return buildAgentProfiles()
}

export function getXmppAgentProfile(agentId?: string) {
  const profiles = buildAgentProfiles()
  if (!agentId) {
    return profiles[0]
  }

  return profiles.find((profile) => profile.agentId === agentId) ?? profiles[0]
}

export function applyAgentPolicy(
  profile: XmppAgentProfile,
  policy: XmppAgentPolicySnapshot | null | undefined,
): XmppAgentProfile {
  if (!policy) {
    return {
      ...profile,
      enabled: profile.enabled ?? true,
      policySource: profile.policySource ?? 'local',
    }
  }

  const preferredRoutes = normalizeRoutes(policy.preferredRoutes)
  const autopayMethods = normalizeAutopayMethods(policy.autopayMethods)

  return {
    ...profile,
    dailyBudgetUsd: policy.dailyBudgetUsd > 0 ? roundUsd(policy.dailyBudgetUsd) : profile.dailyBudgetUsd,
    allowedServices: policy.allowedServices.length > 0 ? [...policy.allowedServices] : profile.allowedServices,
    preferredRoutes: preferredRoutes.length > 0 ? preferredRoutes : profile.preferredRoutes,
    autopayMethods: autopayMethods.length > 0 ? autopayMethods : profile.autopayMethods,
    enabled: policy.enabled,
    policySource: 'merged',
  }
}

export function mergeAgentPolicies(
  profiles: XmppAgentProfile[],
  policies: XmppAgentPolicySnapshot[],
): XmppAgentProfile[] {
  const policiesByAgentId = new Map(policies.map((policy) => [policy.agentId, policy]))

  return profiles.map((profile) => applyAgentPolicy(profile, policiesByAgentId.get(profile.agentId)))
}
