import type {
  XmppCatalogResponse,
  XmppFetchOptions,
  XmppGatewayFetchResponse,
  XmppHealthStatus,
  XmppOperatorState,
  XmppPolicyPreviewResponse,
  XmppReceiptVerificationResult,
  XmppSignedReceipt,
  XmppWalletInfo,
} from '@xmpp/types'

export type XmppGatewayClientOptions = {
  baseUrl?: string | URL
  fetch?: typeof fetch
  headers?: HeadersInit
}

function normalizeBaseUrl(input: string | URL = 'http://localhost:4300') {
  const url = typeof input === 'string' ? input : input.toString()
  return url.replace(/\/+$/, '')
}

function appendIfDefined(
  searchParams: URLSearchParams,
  key: string,
  value?: string | number | boolean,
) {
  if (value === undefined) {
    return
  }

  searchParams.set(key, String(value))
}

export class XmppGatewayClient {
  readonly baseUrl: string
  private readonly fetchImpl: typeof fetch
  private readonly defaultHeaders?: HeadersInit

  constructor(options: XmppGatewayClientOptions = {}) {
    this.baseUrl = normalizeBaseUrl(options.baseUrl)
    this.fetchImpl = options.fetch ?? fetch
    this.defaultHeaders = options.headers
  }

  async health() {
    return this.request<XmppHealthStatus>('/health')
  }

  async wallet() {
    return this.request<XmppWalletInfo>('/wallet')
  }

  async catalog() {
    return this.request<XmppCatalogResponse>('/catalog')
  }

  async operatorState() {
    return this.request<XmppOperatorState>('/operator/state')
  }

  async policyPreview(input: {
    url: string
    method?: string
    serviceId?: string
    projectedRequests?: number
    streaming?: boolean
  }) {
    const searchParams = new URLSearchParams()
    appendIfDefined(searchParams, 'url', input.url)
    appendIfDefined(searchParams, 'method', input.method ?? 'GET')
    appendIfDefined(searchParams, 'serviceId', input.serviceId)
    appendIfDefined(searchParams, 'projectedRequests', input.projectedRequests)
    appendIfDefined(searchParams, 'streaming', input.streaming)
    return this.request<XmppPolicyPreviewResponse>(`/policy/preview?${searchParams.toString()}`)
  }

  async verifyReceipt(receipt: XmppSignedReceipt) {
    return this.request<XmppReceiptVerificationResult>('/receipts/verify', {
      method: 'POST',
      body: JSON.stringify({ receipt }),
    })
  }

  async fetch(
    url: string,
    options: XmppFetchOptions & {
      method?: string
      headers?: Record<string, string>
      body?: unknown
    } = {},
  ) {
    const { method = 'GET', headers, body, ...routeOptions } = options
    return this.request<XmppGatewayFetchResponse>('/fetch', {
      method: 'POST',
      body: JSON.stringify({
        url,
        method,
        headers,
        body,
        options: routeOptions,
      }),
    })
  }

  private async request<T>(path: string, init: RequestInit = {}) {
    const headers = new Headers(this.defaultHeaders)
    headers.set('accept', 'application/json')
    if (init.body && !headers.has('content-type')) {
      headers.set('content-type', 'application/json')
    }

    const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
      ...init,
      headers,
    })

    const text = await response.text()
    if (!response.ok) {
      throw new Error(`xMPP gateway request failed with ${response.status}: ${text}`)
    }

    return (text ? JSON.parse(text) : null) as T
  }
}

export function createXmppGatewayClient(options?: XmppGatewayClientOptions) {
  return new XmppGatewayClient(options)
}
