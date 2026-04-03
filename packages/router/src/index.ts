import type {
  PaymentChallenge,
  RouteContext,
  RouteDecision,
  RouteKind,
  RouteScoreBreakdown,
  ServiceCatalogEntry,
  WorkflowEstimateResult,
  WorkflowEstimateStep,
} from '@xmpp/types'

type CapabilityDocument = {
  serviceId?: string
  paymentModes?: string[]
  preferredAsset?: string
  pricingHints?: Record<string, boolean | number | string>
}

const serviceCatalog: ServiceCatalogEntry[] = [
  {
    serviceId: 'research-api',
    displayName: 'Research API',
    description: 'Low-cost research lookups optimized for exact one-off payments.',
    baseUrl: 'http://localhost:4101',
    capabilities: {
      x402: true,
      mppCharge: false,
      mppSession: false,
    },
    pricing: {
      x402PerCallUsd: 0.01,
      mppChargePerCallUsd: 0.03,
      mppSessionOpenUsd: 0.005,
      mppSessionPerCallUsd: 0.005,
    },
    routingHints: {
      breakEvenCalls: 4,
      streamingPreferred: false,
      preferredSingleCall: 'x402',
    },
  },
  {
    serviceId: 'market-api',
    displayName: 'Market API',
    description: 'Premium market data endpoint exposed through MPP HTTP payment auth.',
    baseUrl: 'http://localhost:4102',
    capabilities: {
      x402: false,
      mppCharge: true,
      mppSession: false,
    },
    pricing: {
      x402PerCallUsd: 0.04,
      mppChargePerCallUsd: 0.03,
      mppSessionOpenUsd: 0.01,
      mppSessionPerCallUsd: 0.01,
    },
    routingHints: {
      breakEvenCalls: 3,
      streamingPreferred: false,
      preferredSingleCall: 'mpp-charge',
    },
  },
  {
    serviceId: 'stream-api',
    displayName: 'Stream API',
    description: 'Repeated tick stream designed to amortize cost over an MPP session.',
    baseUrl: 'http://localhost:4103',
    capabilities: {
      x402: false,
      mppCharge: false,
      mppSession: true,
    },
    pricing: {
      x402PerCallUsd: 0.01,
      mppChargePerCallUsd: 0.03,
      mppSessionOpenUsd: 0.005,
      mppSessionPerCallUsd: 0.005,
    },
    routingHints: {
      breakEvenCalls: 4,
      streamingPreferred: true,
      preferredSingleCall: 'x402',
    },
  },
]

const catalogByServiceId = new Map(serviceCatalog.map((entry) => [entry.serviceId, entry]))
const discoveredCatalog = new Map<string, ServiceCatalogEntry>()
const discoveryTimestamps = new Map<string, number>()
const discoveryInFlight = new Map<string, Promise<ServiceCatalogEntry | null>>()
const DISCOVERY_TTL_MS = 5 * 60 * 1000

function roundUsd(value: number) {
  return Math.round(value * 1000) / 1000
}

function fallbackServiceCatalogEntry(input: RouteContext): ServiceCatalogEntry {
  const hostname = new URL(input.url).host

  return {
    serviceId: input.serviceId ?? hostname,
    displayName: input.serviceId ?? hostname,
    description: 'Fallback catalog entry inferred from request URL.',
    baseUrl: `${new URL(input.url).origin}`,
    source: 'fallback',
    capabilities: {
      x402: true,
      mppCharge: true,
      mppSession: true,
    },
    pricing: {
      x402PerCallUsd: 0.01,
      mppChargePerCallUsd: 0.03,
      mppSessionOpenUsd: 0.005,
      mppSessionPerCallUsd: 0.005,
    },
    routingHints: {
      breakEvenCalls: 4,
      streamingPreferred: false,
      preferredSingleCall: 'x402',
    },
  }
}

function getProjectedRequests(input: Pick<RouteContext, 'projectedRequests'>) {
  return Math.max(1, input.projectedRequests ?? 1)
}

function mergeCatalogEntry(
  base: ServiceCatalogEntry,
  discovery: CapabilityDocument,
  input: RouteContext,
): ServiceCatalogEntry {
  const modes = new Set(discovery.paymentModes ?? [])
  const pricingHints = discovery.pricingHints ?? {}
  const merged: ServiceCatalogEntry = {
    ...base,
    serviceId: discovery.serviceId ?? base.serviceId ?? input.serviceId ?? base.serviceId,
    displayName: base.displayName,
    description: base.description,
    baseUrl: new URL(input.url).origin,
    source: base.source === 'fallback' ? 'discovered' : 'hybrid',
    capabilities: {
      x402: modes.has('x402') || base.capabilities.x402,
      mppCharge: modes.has('mpp-charge') || modes.has('MPP charge') || base.capabilities.mppCharge,
      mppSession: modes.has('mpp-session') || modes.has('MPP session') || base.capabilities.mppSession,
    },
    pricing: {
      x402PerCallUsd:
        typeof pricingHints.x402PerCallUsd === 'number'
          ? pricingHints.x402PerCallUsd
          : typeof pricingHints.perCallUsd === 'number' && modes.has('x402')
            ? pricingHints.perCallUsd
            : base.pricing.x402PerCallUsd,
      mppChargePerCallUsd:
        typeof pricingHints.mppChargePerCallUsd === 'number'
          ? pricingHints.mppChargePerCallUsd
          : typeof pricingHints.perCallUsd === 'number' && (modes.has('mpp-charge') || modes.has('MPP charge'))
            ? pricingHints.perCallUsd
            : base.pricing.mppChargePerCallUsd,
      mppSessionOpenUsd:
        typeof pricingHints.mppSessionOpenUsd === 'number'
          ? pricingHints.mppSessionOpenUsd
          : typeof pricingHints.sessionOpenUsd === 'number'
            ? pricingHints.sessionOpenUsd
            : base.pricing.mppSessionOpenUsd,
      mppSessionPerCallUsd:
        typeof pricingHints.mppSessionPerCallUsd === 'number'
          ? pricingHints.mppSessionPerCallUsd
          : typeof pricingHints.perCallUsd === 'number' &&
              (modes.has('mpp-session') || modes.has('MPP session'))
            ? pricingHints.perCallUsd
            : base.pricing.mppSessionPerCallUsd,
    },
    routingHints: {
      breakEvenCalls:
        typeof pricingHints.breakEvenRequests === 'number'
          ? Math.max(1, Math.round(pricingHints.breakEvenRequests))
          : base.routingHints.breakEvenCalls,
      streamingPreferred:
        typeof pricingHints.streamingPreferred === 'boolean'
          ? pricingHints.streamingPreferred
          : base.routingHints.streamingPreferred,
      preferredSingleCall:
        pricingHints.preferredSingleCall === 'mpp-charge'
          ? 'mpp-charge'
          : pricingHints.preferredSingleCall === 'x402'
            ? 'x402'
            : base.routingHints.preferredSingleCall,
    },
  }

  return merged
}

export function resolveCatalogEntry(input: RouteContext) {
  const discovered =
    (input.serviceId ? discoveredCatalog.get(input.serviceId) : undefined) ??
    [...discoveredCatalog.values()].find((entry) => input.url.startsWith(entry.baseUrl))
  if (discovered) {
    return discovered
  }

  return (
    (input.serviceId ? catalogByServiceId.get(input.serviceId) : undefined) ??
    serviceCatalog.find((entry) => input.url.startsWith(entry.baseUrl)) ??
    fallbackServiceCatalogEntry(input)
  )
}

async function discoverCatalogEntry(input: RouteContext) {
  const existing = resolveCatalogEntry(input)
  if (existing.source !== 'fallback') {
    return existing
  }

  const cacheKey = input.serviceId ?? new URL(input.url).origin
  const cachedAt = discoveryTimestamps.get(cacheKey)
  if (cachedAt && Date.now() - cachedAt < DISCOVERY_TTL_MS) {
    return existing
  }

  const inflight = discoveryInFlight.get(cacheKey)
  if (inflight) {
    return (await inflight) ?? existing
  }

  const discoveryPromise = (async () => {
    try {
      const response = await fetch(new URL('/.well-known/xmpp.json', input.url))
      if (!response.ok) {
        return null
      }

      const discovery = (await response.json()) as CapabilityDocument
      const merged = mergeCatalogEntry(existing, discovery, input)
      discoveredCatalog.set(merged.serviceId, merged)
      discoveryTimestamps.set(cacheKey, Date.now())
      return merged
    } catch {
      return null
    } finally {
      discoveryInFlight.delete(cacheKey)
    }
  })()

  discoveryInFlight.set(cacheKey, discoveryPromise)
  return (await discoveryPromise) ?? existing
}

function getNaiveX402Cost(entry: ServiceCatalogEntry, projectedRequests: number) {
  return projectedRequests * entry.pricing.x402PerCallUsd
}

function getEstimatedCost(
  route: RouteKind,
  entry: ServiceCatalogEntry,
  projectedRequests: number,
  hasReusableSession = false,
) {
  if (route === 'x402') {
    return getNaiveX402Cost(entry, projectedRequests)
  }

  if (route === 'mpp-charge') {
    return projectedRequests * entry.pricing.mppChargePerCallUsd
  }

  const openCost = hasReusableSession || route === 'mpp-session-reuse' ? 0 : entry.pricing.mppSessionOpenUsd
  return openCost + projectedRequests * entry.pricing.mppSessionPerCallUsd
}

export function estimateRouteCost(input: {
  route: RouteKind
  url: string
  method?: string
  serviceId?: string
  projectedRequests?: number
  hasReusableSession?: boolean
}) {
  const context = normalizeContext(input)
  const entry = resolveCatalogEntry(context)
  return roundUsd(
    getEstimatedCost(
      input.route,
      entry,
      getProjectedRequests(context),
      input.hasReusableSession,
    ),
  )
}

function supportsRoute(entry: ServiceCatalogEntry, route: RouteKind) {
  if (route === 'x402') {
    return entry.capabilities.x402
  }

  if (route === 'mpp-charge') {
    return entry.capabilities.mppCharge
  }

  return entry.capabilities.mppSession
}

function scoreRoute(input: {
  entry: ServiceCatalogEntry
  route: RouteKind
  projectedRequests: number
  streaming: boolean
  hasReusableSession?: boolean
}): RouteScoreBreakdown {
  const { entry, route, projectedRequests, streaming, hasReusableSession } = input
  const supported = supportsRoute(entry, route)
  const estimatedTotalUsd = roundUsd(
    getEstimatedCost(route, entry, projectedRequests, hasReusableSession),
  )
  const naiveX402Cost = roundUsd(getNaiveX402Cost(entry, projectedRequests))
  const savingsVsNaiveUsd = roundUsd(naiveX402Cost - estimatedTotalUsd)
  const reasons: string[] = []

  let totalScore = supported ? 0.2 : -1
  if (!supported) {
    reasons.push('Service catalog does not advertise this payment mode.')
    return {
      route,
      supported,
      estimatedTotalUsd,
      savingsVsNaiveUsd,
      totalScore,
      reasons,
    }
  }

  const costDeltaScore = Math.max(-0.2, Math.min(0.45, savingsVsNaiveUsd * 8))
  totalScore += costDeltaScore
  if (costDeltaScore > 0) {
    reasons.push(
      `Estimated ${route} cost is $${estimatedTotalUsd.toFixed(3)}, saving about $${Math.abs(
        savingsVsNaiveUsd,
      ).toFixed(3)} versus naive x402.`,
    )
  } else if (costDeltaScore < 0) {
    reasons.push(`Estimated ${route} cost is higher than x402 for this request shape.`)
  } else {
    reasons.push('Estimated protocol cost is roughly neutral against naive x402.')
  }

  if (route === 'x402') {
    if (projectedRequests === 1 && !streaming) {
      totalScore += 0.28
      reasons.push('Exact settlement fits a single low-friction call.')
    }
    if (entry.routingHints.preferredSingleCall === 'x402') {
      totalScore += 0.1
      reasons.push('Service catalog marks x402 as the preferred one-shot route.')
    }
    if (projectedRequests >= entry.routingHints.breakEvenCalls) {
      totalScore -= 0.18
      reasons.push('Projected repeat volume weakens x402 because fees do not amortize.')
    }
  }

  if (route === 'mpp-charge') {
    if (projectedRequests === 1) {
      totalScore += 0.2
      reasons.push('MPP charge fits premium one-shot HTTP payment auth.')
    }
    if (entry.routingHints.preferredSingleCall === 'mpp-charge') {
      totalScore += 0.14
      reasons.push('Service catalog marks MPP charge as the preferred single-call route.')
    }
    if (projectedRequests >= entry.routingHints.breakEvenCalls) {
      totalScore -= 0.08
      reasons.push('Repeated calls reduce the relative advantage of one-shot charge flows.')
    }
  }

  if (route === 'mpp-session-open' || route === 'mpp-session-reuse') {
    if (streaming || entry.routingHints.streamingPreferred) {
      totalScore += 0.24
      reasons.push('Streaming or repeated access strongly favors session economics.')
    }
    if (projectedRequests >= entry.routingHints.breakEvenCalls) {
      totalScore += 0.18
      reasons.push(`Projected usage crosses the ${entry.routingHints.breakEvenCalls}-call break-even point.`)
    } else {
      totalScore -= 0.1
      reasons.push('Projected usage is below the session break-even threshold.')
    }
    if (route === 'mpp-session-reuse' || hasReusableSession) {
      totalScore += 0.16
      reasons.push('Reusable session removes the channel open cost.')
    } else {
      reasons.push('First session call still carries the channel open cost.')
    }
  }

  return {
    route,
    supported,
    estimatedTotalUsd,
    savingsVsNaiveUsd,
    totalScore: roundUsd(totalScore),
    reasons,
  }
}

function sortBreakdown(left: RouteScoreBreakdown, right: RouteScoreBreakdown) {
  if (right.totalScore !== left.totalScore) {
    return right.totalScore - left.totalScore
  }

  return left.estimatedTotalUsd - right.estimatedTotalUsd
}

function chooseBestDecision(
  entry: ServiceCatalogEntry,
  projectedRequests: number,
  breakdown: RouteScoreBreakdown[],
): RouteDecision {
  const best = [...breakdown].sort(sortBreakdown)[0]

  return {
    route: best.route,
    reason: best.reasons[0] ?? 'xMPP selected the highest scoring route.',
    score: best.totalScore,
    projectedRequests,
    estimatedTotalUsd: best.estimatedTotalUsd,
    savingsVsNaiveUsd: best.savingsVsNaiveUsd,
    service: entry,
    breakdown: [...breakdown].sort(sortBreakdown),
  }
}

function explainPreview(input: RouteContext & { hasReusableSession?: boolean }) {
  const entry = resolveCatalogEntry(input)
  const projectedRequests = getProjectedRequests(input)
  const streaming = Boolean(input.streaming)
  const breakdown = (
    [
      'x402',
      'mpp-charge',
      input.hasReusableSession ? 'mpp-session-reuse' : 'mpp-session-open',
    ] as RouteKind[]
  ).map((route) =>
    scoreRoute({
      entry,
      route,
      projectedRequests,
      streaming,
      hasReusableSession: input.hasReusableSession,
    }),
  )

  return chooseBestDecision(entry, projectedRequests, breakdown)
}

export function getServiceCatalog() {
  const merged = new Map(serviceCatalog.map((entry) => [entry.serviceId, entry]))
  for (const entry of discoveredCatalog.values()) {
    merged.set(entry.serviceId, entry)
  }
  return [...merged.values()]
}

export function getServiceCatalogEntry(serviceId: string) {
  return discoveredCatalog.get(serviceId) ?? catalogByServiceId.get(serviceId) ?? null
}

function normalizeContext(input: {
  url: string
  method?: string
  serviceId?: string
  projectedRequests?: number
  streaming?: boolean
}): RouteContext {
  return {
    ...input,
    method: input.method ?? 'GET',
  }
}

export function createRouter() {
  return {
    async preview(input: RouteContext): Promise<RouteDecision> {
      await discoverCatalogEntry(input)
      return explainPreview(input)
    },
    async chooseFromChallenge(
      input: RouteContext & { challenge: PaymentChallenge; hasReusableSession?: boolean },
    ): Promise<RouteDecision> {
      await discoverCatalogEntry(input)
      if (input.challenge.kind === 'mpp-session') {
        return explainPreview({
          ...input,
          hasReusableSession: input.hasReusableSession,
          streaming: input.streaming ?? true,
        })
      }

      if (input.challenge.kind === 'mpp-charge') {
        const decision = explainPreview(input)
        return {
          ...decision,
          route: 'mpp-charge',
          reason: 'MPP charge challenge detected and the service is requesting one-shot auth.',
        }
      }

      const decision = explainPreview(input)
      return {
        ...decision,
        route: 'x402',
        reason: 'x402 challenge detected and exact settlement is available immediately.',
      }
    },
    explain(input: RouteContext & { hasReusableSession?: boolean }) {
      return explainPreview(input)
    },
    estimateWorkflow(steps: WorkflowEstimateStep[]): WorkflowEstimateResult {
      const breakdown = steps.map((step) => {
        const decision = explainPreview(normalizeContext(step))
        return {
          serviceId: decision.service?.serviceId ?? step.serviceId ?? new URL(step.url).host,
          displayName:
            decision.service?.displayName ?? step.serviceId ?? new URL(step.url).host,
          route: decision.route,
          projectedRequests: Math.max(1, step.projectedRequests),
          estimatedCostUsd: roundUsd(decision.estimatedTotalUsd ?? 0),
          savingsVsNaiveUsd: roundUsd(decision.savingsVsNaiveUsd ?? 0),
          reason: decision.reason,
        }
      })
      const totalEstimatedCostUsd = roundUsd(
        breakdown.reduce((sum, item) => sum + item.estimatedCostUsd, 0),
      )
      const naiveX402CostUsd = roundUsd(
        steps.reduce((sum, step) => {
          const entry = resolveCatalogEntry(normalizeContext(step))
          return sum + getNaiveX402Cost(entry, Math.max(1, step.projectedRequests))
        }, 0),
      )

      return {
        totalEstimatedCostUsd,
        naiveX402CostUsd,
        savingsVsNaiveUsd: roundUsd(naiveX402CostUsd - totalEstimatedCostUsd),
        breakdown,
      }
    },
  }
}
