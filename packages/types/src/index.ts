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

export type ServiceCatalogEntry = {
  serviceId: string
  displayName: string
  description: string
  baseUrl: string
  source?: 'static' | 'discovered' | 'hybrid' | 'fallback'
  capabilities: {
    x402: boolean
    mppCharge: boolean
    mppSession: boolean
  }
  pricing: {
    x402PerCallUsd: number
    mppChargePerCallUsd: number
    mppSessionOpenUsd: number
    mppSessionPerCallUsd: number
  }
  routingHints: {
    breakEvenCalls: number
    streamingPreferred: boolean
    preferredSingleCall: Extract<RouteKind, 'x402' | 'mpp-charge'>
  }
}

export type RouteScoreBreakdown = {
  route: RouteKind
  supported: boolean
  estimatedTotalUsd: number
  savingsVsNaiveUsd: number
  totalScore: number
  reasons: string[]
}

export type RouteDecision = {
  route: RouteKind
  reason: string
  score: number
  projectedRequests?: number
  estimatedTotalUsd?: number
  savingsVsNaiveUsd?: number
  service?: ServiceCatalogEntry
  breakdown?: RouteScoreBreakdown[]
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
  agentId?: string
  maxAutoPayUsd?: number
  idempotencyKey?: string
}

export type XmppAgentProfile = {
  agentId: string
  displayName: string
  role: 'shared' | 'research' | 'market'
  description: string
  dailyBudgetUsd: number
  allowedServices: string[]
  preferredRoutes: RouteKind[]
  autopayMethods: string[]
  enabled?: boolean
  policySource?: 'local' | 'contract' | 'fallback' | 'merged'
}

export type XmppSignedReceipt = {
  receiptId: string
  issuedAt: string
  network: string
  agent: string
  serviceId: string
  url: string
  method: string
  route: RouteKind
  amountUsd: number
  txHash?: string
  explorerUrl?: string
  paymentReference?: string
  signature: string
}

export type XmppSmartAccountExecution = {
  configured: boolean
  preferred: boolean
  supported: boolean
  used: boolean
  contractId?: string | null
  fallbackReason?: string
}

export type PaymentExecutionMetadata = {
  mode: PaymentExecutionMode
  status: PaymentExecutionStatus
  route: RouteKind
  receiptId: string
  missingConfig?: string[]
  evidenceHeaders?: Record<string, string>
  signedReceipt?: XmppSignedReceipt
  settlementStrategy?: 'keypair' | 'smart-account' | 'keypair-fallback'
  executionNote?: string
  feeSponsored?: boolean
  feeSponsorPublicKey?: string
  feeBumpPublicKey?: string
  smartAccount?: XmppSmartAccountExecution
}

export type PolicyDecision = {
  allowed: boolean
  reason: string
  code:
    | 'allowed'
    | 'blocked-domain'
    | 'blocked-path'
    | 'blocked-method'
    | 'blocked-service'
    | 'blocked-agent'
    | 'blocked-budget'
    | 'blocked-idempotency'
    | 'paused'
  source?: 'local' | 'contract' | 'fallback'
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
  budget?: XmppBudgetSnapshot
  idempotentReplay?: boolean
}

export type XmppSessionRecord = {
  sessionId: string
  serviceId: string
  agent: string
  channelContractId: string
  route: string
  status: string
  totalAmountUsdCents: number
  callCount: number
  lastReceiptId: string
  updatedAtLedger: number
}

export type WorkflowEstimateStep = {
  url: string
  method?: string
  serviceId?: string
  projectedRequests: number
  streaming?: boolean
}

export type WorkflowEstimateLineItem = {
  serviceId: string
  displayName: string
  route: RouteKind
  projectedRequests: number
  estimatedCostUsd: number
  savingsVsNaiveUsd: number
  reason: string
}

export type WorkflowEstimateResult = {
  totalEstimatedCostUsd: number
  naiveX402CostUsd: number
  savingsVsNaiveUsd: number
  breakdown: WorkflowEstimateLineItem[]
}

export type XmppBudgetSnapshot = {
  agentId: string
  agentDisplayName: string
  agentSpentThisSessionUsd: number
  agentRemainingDailyBudgetUsd: number
  spentThisSessionUsd: number
  remainingDailyBudgetUsd: number
  callsThisService: number
  projectedCostIfRepeated5xUsd: number
  recommendation: string
}

export type XmppRouteEvent = {
  id: string
  timestamp: string
  agentId: string
  url: string
  method: string
  serviceId: string
  route: RouteKind
  status: 'settled' | 'denied' | 'preview'
  amountUsd: number
  projectedRequests: number
  policyCode?: PolicyDecision['code']
  receiptId?: string
  txHash?: string
  explorerUrl?: string
  sessionId?: string
  signedReceipt?: XmppSignedReceipt
  feeSponsored?: boolean
  feeSponsorPublicKey?: string
  settlementStrategy?: PaymentExecutionMetadata['settlementStrategy']
  executionNote?: string
}

export type XmppAgentStateSummary = {
  agentId: string
  displayName: string
  role: XmppAgentProfile['role']
  description: string
  dailyBudgetUsd: number
  spentThisSessionUsd: number
  remainingDailyBudgetUsd: number
  routeCounts: Record<RouteKind, number>
  allowedServices: string[]
  preferredRoutes: RouteKind[]
  enabled?: boolean
  policySource?: XmppAgentProfile['policySource']
  autopayMethods?: string[]
}

export type XmppAgentPolicySnapshot = {
  agentId: string
  enabled: boolean
  dailyBudgetUsd: number
  allowedServices: string[]
  preferredRoutes: RouteKind[]
  autopayMethods: string[]
  source: 'contract' | 'local' | 'fallback'
}

export type XmppContractTreasurySnapshot = {
  sharedTreasuryUsd: number
  totalSpentUsd: number
  remainingUsd: number
  paymentCount: number
  source: 'contract' | 'local' | 'fallback'
}

export type XmppContractAgentTreasuryState = {
  agentId: string
  spentUsd: number
  paymentCount: number
  lastServiceId: string
  lastRoute: string
  source: 'contract' | 'local' | 'fallback'
}

export type XmppOperatorState = {
  sharedTreasuryUsd: number
  sharedTreasuryRemainingUsd: number
  dailyBudgetUsd: number
  spentThisSessionUsd: number
  remainingDailyBudgetUsd: number
  sessionSavingsUsd: number
  routeCounts: Record<RouteKind, number>
  serviceSpendUsd: Record<string, number>
  serviceCallCounts: Record<string, number>
  agentProfiles: XmppAgentProfile[]
  agentStates: XmppAgentStateSummary[]
  contractAgentPolicies?: XmppAgentPolicySnapshot[]
  contractTreasury?: XmppContractTreasurySnapshot | null
  contractAgentTreasuryStates?: XmppContractAgentTreasuryState[]
  openSessions: Array<Pick<XmppSessionRecord, 'sessionId' | 'serviceId' | 'callCount'>>
  recentEvents: XmppRouteEvent[]
}

export type XmppReceiptVerificationResult = {
  valid: boolean
  agent: string
  receiptId: string
}

export type XmppWalletInfo = {
  connected: boolean
  paymentExecutionMode: PaymentExecutionMode
  network: string
  rpcUrl: string
  agentPublicKey: string | null
  settlementStrategy:
    | 'smart-account-ready'
    | 'smart-account-x402-preferred'
    | 'smart-account-partial-fallback'
    | 'keypair-live'
  smartAccount: {
    ready: boolean
    mode: 'inactive' | 'x402-only' | 'full'
    routeCoverage: 'inactive' | 'x402-only'
    demoReady: boolean
    guardedFallback: boolean
    contractId: string | null
    wasmHash: string
    webauthnVerifierAddress: string
    ed25519VerifierAddress: string
    spendingLimitPolicyAddress: string
    thresholdPolicyAddress: string
    preferredRoutes: RouteKind[]
    fallbackRoutes: RouteKind[]
    supportedRoutes: RouteKind[]
    unsupportedRoutes: RouteKind[]
    unsupportedReason: string | null
    configuredMaxTransactionFeeStroops: number
    effectiveMaxTransactionFeeStroops: number
    feeFloorApplied: boolean
    preflightFailures: string[]
    coverageMessage: string
    message: string
    operatorNotes: string[]
  }
  feeSponsorship: {
    enabled: boolean
    available: boolean
    mppChargeEnabled: boolean
    mppSessionEnabled: boolean
    sponsorPublicKey: string | null
    feeBumpPublicKey: string | null
    message: string
  }
  missingSecrets: string[]
  message: string
}

export type XmppHealthStatus = {
  ok: boolean
  service: string
  network: string
  paymentExecutionMode: PaymentExecutionMode
  services: Record<string, string>
  smartAccount: {
    configured: boolean
    routeCoverage: 'inactive' | 'x402-only'
    x402Preferred: boolean
    mppFallback: boolean
    demoReady: boolean
    guardedFallback: boolean
    unsupportedRoutes: RouteKind[]
    unsupportedReason: string | null
    configuredMaxTransactionFeeStroops: number
    effectiveMaxTransactionFeeStroops: number
    feeFloorApplied: boolean
    preflightFailures: string[]
  }
}

export type XmppCatalogResponse = {
  services: ServiceCatalogEntry[]
}

export type XmppPolicyPreviewResponse = {
  policy: PolicyDecision
  routePreview: RouteDecision
}

export type XmppGatewayFetchResponse = {
  status: number
  routePreview: RouteDecision
  payment?: XmppFetchMetadata
  responseHeaders: Record<string, string>
  body: unknown
}
