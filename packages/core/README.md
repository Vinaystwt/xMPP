# @vinaystwt/xmpp-core

xMPP Core is the public SDK for payment-aware agent calls on Stellar.

It gives you a clean client and local helpers so an agent can call paid tools without hardcoding a single settlement method.

This is the recommended starting point for most direct xMPP integrations outside MCP.

## What It Does

- calls a paid HTTP tool through one gateway client
- surfaces route, budget, receipt, and policy metadata in the response
- exposes local helpers for route scoring and workflow estimation
- supports the same settlement model used by xMPP:
  - `x402` for exact one-off requests
  - `mpp-charge` for premium one-shot requests
  - `mpp-session-open` and `mpp-session-reuse` for repeated or streaming usage

## Install

```bash
npm install @vinaystwt/xmpp-core
```

## Quick Start

```ts
import { XmppGatewayClient } from '@vinaystwt/xmpp-core'

const client = new XmppGatewayClient({ baseUrl: 'http://localhost:4300' })

const result = await client.fetch('http://localhost:4101/research?q=stellar', {
  agentId: 'research-agent',
  serviceId: 'research-api',
  projectedRequests: 1,
})

console.log(result.payment?.route)
console.log(result.payment?.budget)
```

## Local Helpers

The package also exports:

- `@vinaystwt/xmpp-core/local`
  - local `xmppFetch`
  - operator-state helpers
  - local session listing
- router helpers
  - route scoring
  - route estimation
  - service catalog inspection

## CLI

The package includes the `xmpp-demo` bootstrap CLI:

```bash
xmpp-demo bootstrap --dry-run
xmpp-demo bootstrap --friendbot
```

Use it to generate and fund local Stellar testnet identities for the xMPP stack.

## Best For

Use `@vinaystwt/xmpp-core` when you want:

- a gateway client for an existing xMPP deployment
- a single SDK entrypoint for route-aware paid calls
- route economics and workflow estimation in your app

## Related Package

- `@vinaystwt/xmpp-mcp`
  - MCP server package for agent clients that speak MCP over stdio

## Docs

- repo:
  - https://github.com/Vinaystwt/xMPP
- SDK docs:
  - https://github.com/Vinaystwt/xMPP/blob/main/docs/sdk.md
