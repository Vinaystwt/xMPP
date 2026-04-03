import type { Server } from 'node:http'
import { setTimeout as delay } from 'node:timers/promises'
import { createGatewayApp } from '../apps/gateway/src/app.js'
import {
  createMarketApp,
  createResearchApp,
  createStreamApp,
} from '../apps/demo-services/src/index.js'
import { createFacilitatorApp } from '../apps/facilitator/src/index.js'
import { config } from '../packages/config/src/index.js'

type GatewayFetchResult = {
  status: number
  routePreview: {
    route: string
    reason: string
    score: number
  }
  payment: {
    route: string
    retried: boolean
    execution?: {
      mode: 'mock' | 'testnet'
      status: string
      route: string
      receiptId: string
      evidenceHeaders?: Record<string, string>
      missingConfig?: string[]
      settlementStrategy?: string
      executionNote?: string
      feeSponsored?: boolean
      feeSponsorPublicKey?: string
      smartAccount?: {
        configured: boolean
        preferred: boolean
        supported: boolean
        used: boolean
      }
    }
    policy?: {
      allowed: boolean
      reason: string
      code: string
    }
  }
  responseHeaders: Record<string, string>
  body: string
}

type GatewayHealth = {
  ok: boolean
  paymentExecutionMode: 'mock' | 'testnet'
}

type OperatorState = {
  spentThisSessionUsd: number
  sharedTreasuryRemainingUsd: number
  openSessions: Array<{ sessionId: string; serviceId: string; callCount: number }>
  recentEvents: Array<{ serviceId: string; route: string; status: string }>
  routeCounts: Record<string, number>
  agentStates: Array<{ agentId: string; spentThisSessionUsd: number; policySource?: string }>
  contractAgentPolicies?: Array<{ agentId: string }>
}

async function main() {
  const servers: Server[] = []

  try {
    servers.push(await listen(createFacilitatorApp(), portOf(config.x402.facilitatorUrl)))
    servers.push(await listen(createResearchApp(), portOf(config.services.research)))
    servers.push(await listen(createMarketApp(), portOf(config.services.market)))
    servers.push(await listen(createStreamApp(), portOf(config.services.stream)))
    servers.push(await listen(createGatewayApp(), config.gatewayPort))

    await delay(250)

    const health = await getJson<GatewayHealth>(`http://localhost:${config.gatewayPort}/health`)
    const wallet = await getJson(`http://localhost:${config.gatewayPort}/wallet`)
    const x402 = await gatewayFetch({
      url: `${config.services.research}/research?q=stellar`,
      method: 'GET',
      options: { agentId: 'research-agent', serviceId: 'research-api', projectedRequests: 1 },
    })
    const charge = await gatewayFetch({
      url: `${config.services.market}/quote?symbol=XLM`,
      method: 'GET',
      options: { agentId: 'market-agent', serviceId: 'market-api', projectedRequests: 1 },
    })
    const sessionOpen = await gatewayFetch({
      url: `${config.services.stream}/stream/tick`,
      method: 'GET',
      options: {
        agentId: 'market-agent',
        serviceId: 'stream-api',
        projectedRequests: 5,
        streaming: true,
      },
    })
    const sessionReuse = await gatewayFetch({
      url: `${config.services.stream}/stream/tick`,
      method: 'GET',
      options: {
        agentId: 'market-agent',
        serviceId: 'stream-api',
        projectedRequests: 5,
        streaming: true,
      },
    })
    const agentDenied = await gatewayFetch({
      url: `${config.services.market}/quote?symbol=BTC`,
      method: 'GET',
      options: { agentId: 'research-agent', serviceId: 'market-api', projectedRequests: 1 },
    })
    const denied = await gatewayFetch({
      url: 'http://localhost:4102/admin/export',
      method: 'GET',
      options: { serviceId: 'market-api', projectedRequests: 1 },
    })
    const operatorState = await getJson<OperatorState>(
      `http://localhost:${config.gatewayPort}/operator/state`,
    )

    const summary = {
      health,
      wallet,
      operatorState,
      flows: {
        x402,
        charge,
        sessionOpen,
        sessionReuse,
        agentDenied,
        denied,
      },
    }
    try {
      assertSmokeSummary(summary)
    } catch (error) {
      console.error(JSON.stringify(summary, null, 2))
      throw error
    }

    console.log(
      JSON.stringify(
        summary,
        null,
        2,
      ),
    )
  } finally {
    await Promise.allSettled(servers.map(closeServer))
  }
}

async function gatewayFetch(payload: unknown) {
  const response = await fetch(`http://localhost:${config.gatewayPort}/fetch`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  })

  return response.json() as Promise<GatewayFetchResult>
}

async function getJson<T>(url: string) {
  const response = await fetch(url)
  return response.json() as Promise<T>
}

function listen(app: { listen: Server['listen'] }, port: number) {
  return new Promise<Server>((resolve, reject) => {
    const server = app.listen(port, () => resolve(server))
    server.on('error', reject)
  })
}

function closeServer(server: Server) {
  return new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error)
        return
      }

      resolve()
    })
  })
}

function portOf(url: string) {
  return Number(new URL(url).port)
}

function assertSmokeSummary(summary: {
  health: GatewayHealth
  operatorState: OperatorState
  flows: {
    x402: GatewayFetchResult
    charge: GatewayFetchResult
    sessionOpen: GatewayFetchResult
    sessionReuse: GatewayFetchResult
    agentDenied: GatewayFetchResult
    denied: GatewayFetchResult
  }
}) {
  assert(summary.health.ok, 'gateway health check failed')
  assert(summary.flows.x402.status === 200, 'x402 flow did not return 200')
  assert(summary.flows.x402.routePreview.route === 'x402', 'x402 preview route changed')
  assert(summary.flows.charge.status === 200, 'MPP charge flow did not return 200')
  assert(
    summary.flows.charge.routePreview.route === 'mpp-charge',
    'MPP charge preview route changed',
  )
  assert(summary.flows.sessionOpen.status === 200, 'MPP session open flow did not return 200')
  assert(
    summary.flows.sessionOpen.routePreview.route === 'mpp-session-open',
    'MPP session preview route changed',
  )
  assert(
    summary.flows.sessionOpen.payment.route === 'mpp-session-open',
    'First streaming call did not use mpp-session-open',
  )
  assert(
    summary.flows.sessionReuse.payment.route === 'mpp-session-reuse',
    'Second streaming call did not reuse the open MPP session',
  )
  assert(summary.flows.agentDenied.status === 403, 'Agent policy deny should return 403')
  assert(
    summary.flows.agentDenied.payment.policy?.code === 'blocked-agent',
    'Agent policy deny code changed',
  )
  assert(summary.flows.denied.status === 403, 'Denied flow should return 403')
  assert(
    summary.flows.denied.payment.policy?.code === 'blocked-path',
    'Denied flow policy code changed',
  )
  assert(
    summary.operatorState.spentThisSessionUsd >= 0.055,
    'Operator state did not accumulate session spend',
  )
  assert(
    summary.operatorState.openSessions.some((session) => session.serviceId === 'stream-api'),
    'Operator state did not retain the live stream session',
  )
  assert(
    summary.operatorState.agentStates.some(
      (agent) => agent.agentId === 'research-agent' && agent.spentThisSessionUsd >= 0.01,
    ),
    'Research agent spend was not tracked',
  )
  assert(
    summary.operatorState.agentStates.some(
      (agent) => agent.agentId === 'market-agent' && agent.spentThisSessionUsd >= 0.045,
    ),
    'Market agent spend was not tracked',
  )
  assert(
    summary.operatorState.recentEvents.some((event) => event.status === 'denied'),
    'Operator state did not retain the denied event',
  )
  assert(
    summary.flows.x402.payment.execution?.settlementStrategy,
    'x402 execution did not expose settlement strategy',
  )
  assert(
    summary.flows.charge.payment.execution?.settlementStrategy,
    'MPP charge execution did not expose settlement strategy',
  )

  if ((summary.operatorState.contractAgentPolicies?.length ?? 0) > 0) {
    assert(
      summary.operatorState.contractAgentPolicies?.some((policy) => policy.agentId === 'research-agent'),
      'Contract-backed agent policies were not returned in operator state',
    )
    assert(
      summary.operatorState.agentStates.some(
        (agent) => agent.agentId === 'research-agent' && agent.policySource === 'merged',
      ),
      'Research agent did not reflect merged contract policy state',
    )
  }

  if (config.mpp.feeSponsorship.chargeEnabled) {
    assert(
      summary.flows.charge.payment.execution?.feeSponsored === true,
      'MPP charge did not surface fee sponsorship when enabled',
    )
  }

  if (config.mpp.feeSponsorship.sessionEnabled) {
    assert(
      summary.flows.sessionOpen.payment.execution?.feeSponsored === true,
      'MPP session open did not surface fee sponsorship when enabled',
    )
    assert(
      summary.flows.sessionReuse.payment.execution?.feeSponsored === true,
      'MPP session reuse did not surface fee sponsorship when enabled',
    )
  }

  if (summary.health.paymentExecutionMode === 'testnet') {
    assertSettled(summary.flows.x402, 'x402')
    assertSettled(summary.flows.charge, 'mpp-charge')
    assertSettled(summary.flows.sessionOpen, 'mpp-session-open')
    assertSettled(summary.flows.sessionReuse, 'mpp-session-reuse')
  }
}

function assertSettled(flow: GatewayFetchResult, label: string) {
  assert(
    flow.payment.execution?.status === 'settled-testnet',
    `${label} did not settle on Stellar testnet`,
  )
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(`[xMPP smoke] ${message}`)
  }
}

main().catch((error) => {
  console.error('[xMPP] live smoke failed', error)
  process.exit(1)
})
