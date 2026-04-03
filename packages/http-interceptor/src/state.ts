import { config } from '@xmpp/config'
import { createRouter, estimateRouteCost, resolveCatalogEntry } from '@xmpp/router'
import type {
  XmppAgentProfile,
  RouteKind,
  XmppAgentStateSummary,
  XmppBudgetSnapshot,
  XmppOperatorState,
  XmppRouteEvent,
  XmppSessionRecord,
} from '@xmpp/types'
import { getXmppAgentProfile, listXmppAgentProfiles } from './agents.js'

const router = createRouter()
const recentEvents: XmppRouteEvent[] = []
const serviceSpendUsd = new Map<string, number>()
const serviceCallCounts = new Map<string, number>()
const agentSpendUsd = new Map<string, number>()
const agentServiceCallCounts = new Map<string, number>()
const agentRouteCounts = new Map<string, Record<RouteKind, number>>()
const routeCounts: Record<RouteKind, number> = {
  x402: 0,
  'mpp-charge': 0,
  'mpp-session-open': 0,
  'mpp-session-reuse': 0,
}
const openSessions = new Map<string, Pick<XmppSessionRecord, 'sessionId' | 'serviceId' | 'callCount'>>()
let sessionSavingsUsd = 0

function roundUsd(value: number) {
  return Math.round(value * 1000) / 1000
}

function pushEvent(event: XmppRouteEvent) {
  recentEvents.unshift(event)
  if (recentEvents.length > 25) {
    recentEvents.length = 25
  }
}

function emptyRouteCounts(): Record<RouteKind, number> {
  return {
    x402: 0,
    'mpp-charge': 0,
    'mpp-session-open': 0,
    'mpp-session-reuse': 0,
  }
}

function getAgentRouteCounter(agentId: string) {
  const existing = agentRouteCounts.get(agentId)
  if (existing) {
    return existing
  }

  const created = emptyRouteCounts()
  agentRouteCounts.set(agentId, created)
  return created
}

export function recordXmppEvent(input: Omit<XmppRouteEvent, 'id' | 'timestamp'>) {
  const event: XmppRouteEvent = {
    id: `evt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    timestamp: new Date().toISOString(),
    ...input,
    amountUsd: roundUsd(input.amountUsd),
  }

  pushEvent(event)

  if (event.status === 'settled' && event.amountUsd > 0) {
    routeCounts[event.route] += 1
    getAgentRouteCounter(event.agentId)[event.route] += 1
    serviceSpendUsd.set(
      event.serviceId,
      roundUsd((serviceSpendUsd.get(event.serviceId) ?? 0) + event.amountUsd),
    )
    serviceCallCounts.set(event.serviceId, (serviceCallCounts.get(event.serviceId) ?? 0) + 1)
    agentSpendUsd.set(
      event.agentId,
      roundUsd((agentSpendUsd.get(event.agentId) ?? 0) + event.amountUsd),
    )
    agentServiceCallCounts.set(
      `${event.agentId}:${event.serviceId}`,
      (agentServiceCallCounts.get(`${event.agentId}:${event.serviceId}`) ?? 0) + 1,
    )

    const naiveCost = estimateRouteCost({
      route: 'x402',
      url: event.url,
      method: event.method,
      serviceId: event.serviceId,
      projectedRequests: 1,
    })
    sessionSavingsUsd = roundUsd(sessionSavingsUsd + Math.max(0, naiveCost - event.amountUsd))
  }

  return event
}

export function upsertLocalSession(sessionId: string, serviceId: string, callCount: number) {
  openSessions.set(sessionId, {
    sessionId,
    serviceId,
    callCount,
  })
}

export function listLocalSessions() {
  return [...openSessions.values()]
}

export function buildBudgetSnapshot(input: {
  agentId?: string
  agentProfile?: XmppAgentProfile
  url: string
  method: string
  serviceId?: string
  route: RouteKind
  projectedRequests?: number
  hasReusableSession?: boolean
}): XmppBudgetSnapshot {
  const agent = input.agentProfile ?? getXmppAgentProfile(input.agentId)
  const serviceId = input.serviceId ?? resolveCatalogEntry(input).serviceId
  const callsThisService = agentServiceCallCounts.get(`${agent.agentId}:${serviceId}`) ?? 0
  const agentSpentThisSessionUsd = roundUsd(agentSpendUsd.get(agent.agentId) ?? 0)
  const agentRemainingDailyBudgetUsd = roundUsd(
    Math.max(0, agent.dailyBudgetUsd - agentSpentThisSessionUsd),
  )
  const spentThisSessionUsd = roundUsd(
    [...serviceSpendUsd.values()].reduce((sum, value) => sum + value, 0),
  )
  const remainingDailyBudgetUsd = roundUsd(Math.max(0, config.dailyBudgetUsd - spentThisSessionUsd))
  const projectedCostIfRepeated5xUsd = roundUsd(
    estimateRouteCost({
      route: input.route,
      url: input.url,
      method: input.method,
      serviceId,
      projectedRequests: 5,
      hasReusableSession: input.hasReusableSession,
    }),
  )
  const catalog = resolveCatalogEntry({
    url: input.url,
    method: input.method,
    serviceId,
    projectedRequests: input.projectedRequests,
    streaming: false,
  })
  const repeatDecision = router.explain({
    url: input.url,
    method: input.method,
    serviceId,
    projectedRequests: Math.max(callsThisService + 1, catalog.routingHints.breakEvenCalls),
    streaming: catalog.routingHints.streamingPreferred,
    hasReusableSession: input.hasReusableSession,
  })

  let recommendation = `${repeatDecision.service?.displayName ?? serviceId} stays on ${repeatDecision.route} under the current usage forecast.`
  if (
    input.route === 'x402' &&
    catalog.capabilities.mppSession &&
    callsThisService < catalog.routingHints.breakEvenCalls
  ) {
    const remainingCalls = catalog.routingHints.breakEvenCalls - callsThisService
    recommendation = `Switch to MPP session after ${remainingCalls} more calls to amortize channel setup.`
  } else if (input.route === 'mpp-session-open' || input.route === 'mpp-session-reuse') {
    recommendation = 'Keep reusing the current MPP session to compress repeat spend into one channel lifecycle.'
  } else if (input.route === 'mpp-charge') {
    recommendation = 'MPP charge remains the cleanest path for premium one-shot calls on this service.'
  }

  return {
    agentId: agent.agentId,
    agentDisplayName: agent.displayName,
    agentSpentThisSessionUsd,
    agentRemainingDailyBudgetUsd,
    spentThisSessionUsd,
    remainingDailyBudgetUsd,
    callsThisService,
    projectedCostIfRepeated5xUsd,
    recommendation,
  }
}

export function buildAgentStates(profiles: XmppAgentProfile[] = listXmppAgentProfiles()): XmppAgentStateSummary[] {
  return profiles.map((profile) => {
    const spentThisSessionUsd = roundUsd(agentSpendUsd.get(profile.agentId) ?? 0)
    return {
      agentId: profile.agentId,
      displayName: profile.displayName,
      role: profile.role,
      description: profile.description,
      dailyBudgetUsd: profile.dailyBudgetUsd,
      spentThisSessionUsd,
      remainingDailyBudgetUsd: roundUsd(Math.max(0, profile.dailyBudgetUsd - spentThisSessionUsd)),
      routeCounts: { ...getAgentRouteCounter(profile.agentId) },
      allowedServices: [...profile.allowedServices],
      preferredRoutes: [...profile.preferredRoutes],
      enabled: profile.enabled ?? true,
      policySource: profile.policySource ?? 'local',
      autopayMethods: [...profile.autopayMethods],
    }
  })
}

export function getXmppOperatorState(agentProfiles: XmppAgentProfile[] = listXmppAgentProfiles()): XmppOperatorState {
  const spentThisSessionUsd = roundUsd(
    [...serviceSpendUsd.values()].reduce((sum, value) => sum + value, 0),
  )

  return {
    sharedTreasuryUsd: config.dailyBudgetUsd,
    sharedTreasuryRemainingUsd: roundUsd(Math.max(0, config.dailyBudgetUsd - spentThisSessionUsd)),
    dailyBudgetUsd: config.dailyBudgetUsd,
    spentThisSessionUsd,
    remainingDailyBudgetUsd: roundUsd(Math.max(0, config.dailyBudgetUsd - spentThisSessionUsd)),
    sessionSavingsUsd,
    routeCounts: { ...routeCounts },
    serviceSpendUsd: Object.fromEntries(serviceSpendUsd),
    serviceCallCounts: Object.fromEntries(serviceCallCounts),
    agentProfiles,
    agentStates: buildAgentStates(agentProfiles),
    openSessions: listLocalSessions(),
    recentEvents: [...recentEvents],
  }
}

export function resetXmppOperatorState() {
  recentEvents.length = 0
  serviceSpendUsd.clear()
  serviceCallCounts.clear()
  agentSpendUsd.clear()
  agentServiceCallCounts.clear()
  agentRouteCounts.clear()
  openSessions.clear()
  sessionSavingsUsd = 0
  routeCounts.x402 = 0
  routeCounts['mpp-charge'] = 0
  routeCounts['mpp-session-open'] = 0
  routeCounts['mpp-session-reuse'] = 0
}
