import { createHash } from 'node:crypto'
import type { XmppFetchMetadata, XmppFetchOptions } from '@xmpp/types'

type IdempotencySnapshot = {
  fingerprint: string
  storedAt: number
  inflight: boolean
  response?: {
    status: number
    statusText: string
    headers: Record<string, string>
    body: string
    metadata: XmppFetchMetadata
  }
}

const IDEMPOTENCY_TTL_MS = 60 * 60 * 1000
const idempotencyCache = new Map<string, IdempotencySnapshot>()

function normalizeBody(body: BodyInit | null | undefined) {
  if (body == null) {
    return ''
  }

  if (typeof body === 'string') {
    return body
  }

  if (body instanceof URLSearchParams) {
    return body.toString()
  }

  if (body instanceof FormData) {
    const entries: string[] = []
    body.forEach((value, key) => {
      entries.push(`${key}=${typeof value === 'string' ? value : value.name}`)
    })
    return entries.join('&')
  }

  return '[stream]'
}

function cleanupExpired() {
  const cutoff = Date.now() - IDEMPOTENCY_TTL_MS
  for (const [key, snapshot] of idempotencyCache.entries()) {
    if (snapshot.storedAt < cutoff) {
      idempotencyCache.delete(key)
    }
  }
}

function buildFingerprint(url: string, method: string, init?: RequestInit) {
  const headers = new Headers(init?.headers)
  const headerPairs: string[] = []
  headers.forEach((value, key) => {
    headerPairs.push(`${key.toLowerCase()}=${value}`)
  })
  headerPairs.sort()

  return createHash('sha256')
    .update(
      JSON.stringify({
        url,
        method: method.toUpperCase(),
        headers: headerPairs,
        body: normalizeBody(init?.body),
      }),
    )
    .digest('hex')
}

function resolveIdempotencyKey(init: RequestInit | undefined, options: XmppFetchOptions | undefined) {
  const headers = new Headers(init?.headers)
  return (
    options?.idempotencyKey ??
    headers.get('idempotency-key') ??
    headers.get('x-idempotency-key') ??
    undefined
  )
}

export function inspectIdempotency(
  url: string,
  method: string,
  init?: RequestInit,
  options?: XmppFetchOptions,
) {
  cleanupExpired()

  const upperMethod = method.toUpperCase()
  if (upperMethod === 'GET' || upperMethod === 'HEAD') {
    return { allowed: true as const }
  }

  const idempotencyKey = resolveIdempotencyKey(init, options)
  if (!idempotencyKey) {
    return {
      allowed: false as const,
      code: 'missing-key',
      reason: 'Automatic payment for non-GET requests requires an idempotency key.',
    }
  }

  const fingerprint = buildFingerprint(url, upperMethod, init)
  const existing = idempotencyCache.get(idempotencyKey)
  if (!existing) {
    idempotencyCache.set(idempotencyKey, {
      fingerprint,
      storedAt: Date.now(),
      inflight: true,
    })
    return {
      allowed: true as const,
      idempotencyKey,
      fingerprint,
    }
  }

  if (existing.fingerprint !== fingerprint) {
    return {
      allowed: false as const,
      code: 'mismatch',
      reason: 'This idempotency key was already used for a different request payload.',
    }
  }

  if (existing.inflight || !existing.response) {
    return {
      allowed: false as const,
      code: 'inflight',
      reason: 'An idempotent request with this key is already in progress.',
    }
  }

  return {
    allowed: true as const,
    idempotencyKey,
    fingerprint,
    replay: true as const,
    response: existing.response,
  }
}

export async function storeIdempotentResponse(
  idempotencyKey: string,
  fingerprint: string,
  response: Response,
  metadata: XmppFetchMetadata,
) {
  const body = await response.clone().text()
  const headers: Record<string, string> = {}
  response.headers.forEach((value, key) => {
    headers[key] = value
  })
  idempotencyCache.set(idempotencyKey, {
    fingerprint,
    storedAt: Date.now(),
    inflight: false,
    response: {
      status: response.status,
      statusText: response.statusText,
      headers,
      body,
      metadata,
    },
  })
}

export function clearIdempotentReservation(idempotencyKey: string, fingerprint: string) {
  const existing = idempotencyCache.get(idempotencyKey)
  if (existing && existing.fingerprint === fingerprint && existing.inflight) {
    idempotencyCache.delete(idempotencyKey)
  }
}

export function buildIdempotentReplay(snapshot: IdempotencySnapshot['response']) {
  if (!snapshot) {
    return null
  }

  const headers = new Headers(snapshot.headers)
  headers.set('x-xmpp-idempotency-replay', 'true')

  return {
    response: new Response(snapshot.body, {
      status: snapshot.status,
      statusText: snapshot.statusText,
      headers,
    }),
    metadata: {
      ...snapshot.metadata,
      idempotentReplay: true,
    },
  }
}

export function resetIdempotencyCache() {
  idempotencyCache.clear()
}
