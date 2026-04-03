# xMPP

<p>
  <img src="./assets/xmpp-mark.svg" alt="xMPP logo" width="72" height="72" />
</p>

The ultimate x402 ↔ MPP brain for autonomous agents on Stellar.

xMPP gives an agent one payment-aware fetch path that can:

- call a paid tool normally
- intercept `402 Payment Required`
- evaluate policy and route economics
- settle through `x402`, `MPP charge`, or `MPP session`
- retry automatically
- return operator-facing route, budget, and session metadata

## What Exists Now

- gateway API for paid fetches, route previews, operator state, and wallet status
- MCP server with fetch, wallet, preview, explain, session, and workflow-estimation tools
- demo services for x402, MPP charge, and MPP session flows
- operator dashboard with live route counts, budget state, session telemetry, and event feed
- shared treasury agents with separate research and market worker ceilings on one wallet
- installable `@xmpp/core` SDK and `@xmpp/mcp` server package surfaces
- Soroban contracts for global policy, service policy, pause control, and session registry
- runtime contract wiring with local fallback when contract ids are absent
- live smoke script covering x402, MPP charge, MPP session open, MPP session reuse, and deny-by-policy

## Architecture

- `apps/gateway`
  - JSON API for fetch, policy preview, wallet state, catalog, and operator state
- `apps/demo-services`
  - paid local services used in the demo, including `/.well-known/xmpp.json` capability documents
- `apps/mcp-server`
  - publishable `@xmpp/mcp` stdio MCP server for Claude, Codex, and other MCP clients
- `apps/dashboard`
  - operator console for the demo
- `packages/router`
  - catalog-driven route scoring and workflow estimation
- `packages/http-interceptor`
  - 402 interception, retry, budget snapshots, and operator event tracking
  - shared-treasury agent controls and per-agent budget accounting
- `packages/payment-adapters`
  - x402 and MPP payment execution adapters
- `packages/core`
  - publishable SDK with gateway client, route planning, and a bootstrap CLI
- `packages/policy-engine`
  - local and contract-backed policy decisions
- `contracts`
  - `xmpp-policy` and `xmpp-session-registry`

## Quick Start

```bash
pnpm install
cp .env.example .env
pnpm xmpp:bootstrap -- --dry-run
pnpm xmpp:bootstrap -- --friendbot
pnpm check
```

Start each process in its own terminal:

```bash
pnpm xmpp:facilitator
pnpm xmpp:services
pnpm xmpp:gateway
pnpm xmpp:dashboard
pnpm xmpp:mcp
```

Default ports:

- facilitator: `http://localhost:4022`
- gateway: `http://localhost:4300`
- dashboard: `http://localhost:4310`
- research API: `http://localhost:4101`
- market API: `http://localhost:4102`
- stream API: `http://localhost:4103`

## Required Environment

Core live settlement values:

- `XMPP_AGENT_SECRET_KEY`
- `FACILITATOR_STELLAR_PRIVATE_KEY`
- `MPP_SECRET_KEY`

Optional but important for the full demo:

- `X402_RECIPIENT_ADDRESS`
- `MPP_RECIPIENT_ADDRESS`
- `MPP_CHANNEL_CONTRACT_ID`
- `XMPP_POLICY_CONTRACT_ID`
- `XMPP_SESSION_REGISTRY_CONTRACT_ID`

Generate free Stellar testnet identities:

```bash
stellar keys generate agent
stellar keys generate facilitator
stellar keys generate mpp-server

stellar keys secret agent
stellar keys secret facilitator
stellar keys secret mpp-server
```

Fund them with Friendbot:

```bash
curl "https://friendbot.stellar.org/?addr=$(stellar keys address agent)"
curl "https://friendbot.stellar.org/?addr=$(stellar keys address facilitator)"
curl "https://friendbot.stellar.org/?addr=$(stellar keys address mpp-server)"
```

## Verification

Workspace checks:

```bash
pnpm check
cd contracts && cargo test
pnpm release:pack
```

Live smoke path:

```bash
pnpm xmpp:smoke
pnpm xmpp:demo:smoke
```

The smoke script exercises:

- `x402`
- `mpp-charge`
- `mpp-session-open`
- `mpp-session-reuse`

## Installable Packages

The public package family is release-packed locally through:

```bash
pnpm release:pack
```

That creates `.release/manifest.json` plus tarballs for the publishable workspace packages, including `@xmpp/core` and `@xmpp/mcp`.
- policy deny flow

## Gateway API

- `GET /health`
- `GET /wallet`
- `GET /catalog`
- `GET /operator/state`
- `GET /policy/preview?url=...`
- `POST /receipts/verify`
- `POST /fetch`

Example paid fetch:

```bash
curl -s http://localhost:4300/fetch \
  -H 'content-type: application/json' \
  -d '{
    "url":"http://localhost:4101/research?q=stellar",
    "method":"GET",
    "options":{"agentId":"research-agent","serviceId":"research-api","projectedRequests":1}
  }' | jq
```

## MCP Tools

- `xmpp_fetch`
- `xmpp_agent_profiles`
- `xmpp_wallet_info`
- `xmpp_policy_preview`
- `xmpp_explain`
- `xmpp_session_list`
- `xmpp_estimate_workflow`
- `xmpp_receipt_verify`

## Installable Packages

Build the publishable surfaces locally:

```bash
pnpm --filter @xmpp/core build
pnpm --filter @xmpp/mcp build
```

Intended package entrypoints:

- `@xmpp/core`
  - gateway client, router helpers, and type exports
- `@xmpp/core/local`
  - in-process `xmppFetch` and operator-state helpers
- `@xmpp/mcp`
  - MCP server factory for stdio agent integrations
- `xmpp-demo bootstrap`
  - SDK CLI for generating and funding testnet identities into a local `.env.local`

Example signed receipt verification:

```bash
curl -s http://localhost:4300/receipts/verify \
  -H 'content-type: application/json' \
  -d '{
    "receipt":{
      "receiptId":"xmpp_x402_demo",
      "issuedAt":"2026-04-03T00:00:00.000Z",
      "network":"stellar:testnet",
      "agent":"G...",
      "serviceId":"research-api",
      "url":"http://localhost:4101/research?q=stellar",
      "method":"GET",
      "route":"x402",
      "amountUsd":0.01,
      "signature":"..."
    }
  }' | jq
```

## Contracts

Build and test:

```bash
cd contracts
cargo test
```

Deploy to Stellar testnet:

```bash
./contracts/scripts/deploy-testnet.sh <stellar-identity-or-secret>
```

The deploy script writes ids to `contracts/scripts/addresses.json`.

## Docs

- [architecture.md](./docs/architecture.md)
- [api-catalog.md](./docs/api-catalog.md)
- [router-algorithm.md](./docs/router-algorithm.md)
- [demo-script.md](./docs/demo-script.md)
- [threat-model.md](./docs/threat-model.md)
- [PROTOCOL.md](./docs/PROTOCOL.md)
- [sdk.md](./docs/sdk.md)
- [python-client.py](./examples/python-client.py)
- [node-sdk.ts](./examples/node-sdk.ts)
- [langchain-agent.py](./examples/langchain-agent.py)

## Current Gaps

- smart-account execution is still partial and not yet the default settlement path
- service discovery is exposed for the demo through `/.well-known/xmpp.json`, but the router is still local-catalog first
- fee sponsorship is route-specific: the verified demo configuration keeps `mpp-charge` agent-funded and enables service-sponsored gas for `mpp-session`
- deeper contract-backed multi-agent treasury controls are live, but smart-account-first settlement is still stretch work
