export { createXmppGatewayClient, XmppGatewayClient } from './gateway-client.js'
export { createRouter, estimateRouteCost, getServiceCatalog, getServiceCatalogEntry } from '@xmpp/router'
export type {
  RouteContext,
  RouteDecision,
  RouteKind,
  RouteScoreBreakdown,
  ServiceCatalogEntry,
  WorkflowEstimateResult,
  WorkflowEstimateStep,
  XmppAgentProfile,
  XmppBudgetSnapshot,
  XmppCatalogResponse,
  XmppFetchMetadata,
  XmppFetchOptions,
  XmppGatewayFetchResponse,
  XmppHealthStatus,
  XmppOperatorState,
  XmppPolicyPreviewResponse,
  XmppReceiptVerificationResult,
  XmppRouteEvent,
  XmppSignedReceipt,
  XmppWalletInfo,
} from '@xmpp/types'
