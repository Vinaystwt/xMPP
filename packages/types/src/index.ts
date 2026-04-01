export type RouteKind = 'x402' | 'mpp-charge' | 'mpp-session-open' | 'mpp-session-reuse'
export type PaymentExecutionMode = 'mock' | 'testnet'
export type PaymentExecutionStatus =
  | 'mock-paid'
  | 'ready-for-testnet'
  | 'settled-testnet'
  | 'missing-config'

export type RouteContext = {
  url: string
  method: string
  serviceId?: string
  projectedRequests?: number
  streaming?: boolean
}

export type RouteDecision = {
  route: RouteKind
  reason: string
  score: number
}

export type ChallengeKind = 'x402' | 'mpp-charge' | 'mpp-session'

export type PaymentChallenge = {
  kind: ChallengeKind
  service: string
  amountUsd: number
  asset: 'USDC_TESTNET'
  retryHeaderName: string
  retryHeaderValue: string
  sessionId?: string
}

export type XmppFetchOptions = Omit<RouteContext, 'url' | 'method'> & {
  maxAutoPayUsd?: number
}

export type PaymentExecutionMetadata = {
  mode: PaymentExecutionMode
  status: PaymentExecutionStatus
  route: RouteKind
  receiptId: string
  missingConfig?: string[]
  evidenceHeaders?: Record<string, string>
}

export type PolicyDecision = {
  allowed: boolean
  reason: string
  code: 'allowed' | 'blocked-domain' | 'blocked-path'
}

export type PaymentExecutionResult = {
  response: Response
  metadata: PaymentExecutionMetadata
}

export type XmppFetchMetadata = {
  route: RouteKind
  challenge?: PaymentChallenge
  retried: boolean
  execution?: PaymentExecutionMetadata
  policy?: PolicyDecision
}
