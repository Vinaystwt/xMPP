# xMPP SDK

## Packages

### Recommended entrypoints

- `@vinaystwt/xmpp-core`
  - gateway client for `GET /health`, `GET /wallet`, `GET /catalog`, `GET /operator/state`, `GET /policy/preview`, `POST /receipts/verify`, and `POST /fetch`
  - router helpers for preview and workflow estimation
  - shared xMPP type exports for gateway consumers
- `@vinaystwt/xmpp-core/local`
  - in-process `xmppFetch`, metadata extraction, local session listing, and operator-state helpers
- `@vinaystwt/xmpp-mcp`
  - `createXmppMcpServer()` and `runXmppMcpServer()` for stdio MCP integrations

## CLI

The SDK ships a small bootstrap CLI:

```bash
xmpp-demo bootstrap --dry-run
xmpp-demo bootstrap --friendbot --fee-sponsor
```

It generates `XMPP_AGENT_SECRET_KEY`, `FACILITATOR_STELLAR_PRIVATE_KEY`, and `MPP_SECRET_KEY` into a local `.env.local`, with optional Friendbot funding and optional fee-sponsor identity generation.

## Local Release Verification

Use the workspace release check to build and pack the public package family into `.release/`:

```bash
pnpm release:pack:public
```

That flow stages the published npm package family, with `@vinaystwt/xmpp-core` and `@vinaystwt/xmpp-mcp` as the recommended entrypoints.

## Example

```ts
import { XmppGatewayClient } from '@vinaystwt/xmpp-core'

const client = new XmppGatewayClient({ baseUrl: 'http://localhost:4300' })
const result = await client.fetch('http://localhost:4101/research?q=stellar', {
  agentId: 'research-agent',
  serviceId: 'research-api',
  projectedRequests: 1,
})

console.log(result.payment?.route)
```
