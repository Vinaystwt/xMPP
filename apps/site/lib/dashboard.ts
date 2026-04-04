export type EventType = 'reuse' | 'deny' | 'open' | 'charge' | 'x402'

export type DashboardEvent = {
  time: string
  route: string
  service: string
  amount: string
  type: EventType
}

export type SessionRecord = {
  service: string
  status: 'OPEN' | 'CLOSED'
  calls: number
  saved?: string
}

export type BudgetRecord = {
  agent: string
  used: number
  total: number
}

export type ServiceControl = {
  service: string
  enabled: boolean
}

export const MOCK_EVENTS: DashboardEvent[] = [
  { time: '12:04:31', route: 'mpp-session-reuse', service: 'stream-api', amount: '$0.005', type: 'reuse' },
  { time: '12:04:28', route: 'DENY', service: 'agent-beta', amount: 'policy', type: 'deny' },
  { time: '12:04:25', route: 'mpp-session-open', service: 'stream-api', amount: '$0.010', type: 'open' },
  { time: '12:04:22', route: 'mpp-charge', service: 'market-api', amount: '$0.030', type: 'charge' },
  { time: '12:04:19', route: 'x402', service: 'research-api', amount: '$0.010', type: 'x402' },
]

export const INITIAL_EVENTS = MOCK_EVENTS.slice(0, 3)

export const ACTIVE_SESSIONS: SessionRecord[] = [
  { service: 'stream-api', status: 'OPEN', calls: 3, saved: '$0.015 saved' },
  { service: 'market-api', status: 'CLOSED', calls: 1 },
]

export const AGENT_BUDGETS: BudgetRecord[] = [
  { agent: 'agent-alpha', used: 4.82, total: 5 },
  { agent: 'agent-beta', used: 0.12, total: 5 },
]

export const SERVICE_CONTROLS: ServiceControl[] = [
  { service: 'research-api', enabled: true },
  { service: 'market-api', enabled: true },
  { service: 'stream-api', enabled: true },
]

export const TREASURY_STATE = {
  wallet: 'G3X...K9P',
  treasury: '$2.847',
  totalSpend: '$0.060',
  remainingBudget: '$9.940',
}

export function eventColor(type: EventType) {
  switch (type) {
    case 'reuse':
      return 'var(--route-mpp-session-reuse)'
    case 'deny':
      return 'var(--route-deny)'
    case 'open':
      return 'var(--route-mpp-session-open)'
    case 'charge':
      return 'var(--route-mpp-charge)'
    case 'x402':
      return 'var(--route-x402)'
  }
}

export function eventGlow(type: EventType) {
  switch (type) {
    case 'reuse':
      return 'var(--glow-mpp-session-reuse)'
    case 'deny':
      return 'rgba(255, 145, 83, 0.24)'
    case 'open':
      return 'var(--glow-mpp-session-open)'
    case 'charge':
      return 'var(--glow-mpp-charge)'
    case 'x402':
      return 'var(--glow-x402)'
  }
}
