<p align="center">
  <img src="./assets/xmpp-mark.svg" alt="xMPP" width="72" height="72" />
</p>

<h1 align="center">xMPP</h1>

<p align="center">
  <strong>The payment-routing brain and policy control plane for autonomous agents on Stellar.</strong>
</p>

<p align="center">
  <a href="https://xmpp-vinaystwts-projects.vercel.app">Live Demo</a> ·
  <a href="https://xmpp-vinaystwts-projects.vercel.app/dashboard">Operator Dashboard</a> ·
  <a href="https://dorahacks.io/hackathon/stellar-agents-x402-stripe-mpp/detail">DoraHacks Submission</a>
</p>

---

## What xMPP Is

Most agent payment demos show one settlement path. An agent locked to x402 pays per-call even when session reuse costs 25% less. An agent that opens MPP sessions for single requests wastes overhead. The choice of settlement primitive is a routing problem — and no existing tool solves it.

xMPP is the routing layer between an agent and its paid tools. It intercepts every `402 Payment Required` response, scores four available settlement paths against cost, frequency, policy, and session state, and settles through the optimal primitive automatically. Operators retain full visibility and control throughout.

> xMPP = x402 + MPP routing on Stellar. Not the XMPP/Jabber messaging protocol.

---

## The Four Routes

| Route | When It Wins | Cost Model |
|-------|-------------|------------|
| `x402` | Single exact request, no session overhead needed | Per-call, smart-account capable |
| `mpp-charge` | Premium single shot where MPP beats naive x402 | Per-call, agent-funded |
| `mpp-session-open` | Repeated or streaming calls, no session exists | Session overhead + per-call reuse |
| `mpp-session-reuse` | Session already open, reuse removes open cost | Cheapest repeated-call path |

Route selection is automatic. The agent makes one call. xMPP decides.

---

## Live Proof

All four routes verified on Stellar testnet:

| Route | Transaction |
|-------|------------|
| x402 smart-account | [2cc2f8b5...b37b5b](https://stellar.expert/explorer/testnet/tx/2cc2f8b5388e341e66a5ee68ebd000bf4804d314b82136d091e9b33dbdb37b5b) |
| mpp-charge | [3125c05d...241b34e](https://stellar.expert/explorer/testnet/tx/3125c05d57563e027717cc52eff478c6612cb55fcd57a2eaee21cd5f3241b34e) |
| x402 preflight | [16c30932...155f1e5](https://stellar.expert/explorer/testnet/tx/16c3093215a363b79ed8a5678d9549236b8b7a74f2b818caa3c46d4c5155f1e5) |

Reproduce the full verification path:
```bash
pnpm xmpp:judge:preflight
```

---

## Session Economics

xMPP makes MPP session savings visible instead of hiding them.

Latest verified smoke run:

- First stream call: `mpp-session-open` at `$0.010`
- Second stream call: `mpp-session-reuse` at `$0.005`
- Naive x402 equivalent: `$0.020`
- Actual session cost: `$0.015`
- **Savings: `$0.005` (25%)**

Savings compound across thousands of agent calls per hour.

---

## Route Economics

xMPP scores routes against request shape, service hints, session state, and policy before settling.

![Route Economics](./assets/route-economics.svg)

| Scenario | Routes Considered | Winner | Saving |
|----------|------------------|--------|--------|
| Research API — 1 exact call | x402 $0.01, mpp-charge $0.04 | x402 | — |
| Market API — 1 premium quote | x402 $0.04, mpp-charge $0.03 | mpp-charge | $0.01 |
| Stream API — 5 calls, no session | x402 $0.05, session-open $0.03 | mpp-session-open | $0.02 |
| Stream API — 5 calls, session open | x402 $0.05, session-reuse $0.025 | mpp-session-reuse | $0.025 |

See [router-algorithm.md](./docs/router-algorithm.md) for the full scoring model.

---

## Operator Control

xMPP gives operators full visibility without removing agent autonomy.

![Dashboard Snapshot](./assets/dashboard-proof.svg)

- **Budget ceilings** — per-agent and per-service spending limits
- **Policy enforcement** — deny-before-pay with contract-backed rules
- **Signed receipts** — verifiable settlement proof per call
- **Session telemetry** — open/reuse/close lifecycle visible in operator state
- **Treasury tracking** — contract-backed shared treasury with per-agent accounting
- **Pause flag** — instant global or service-level pause via Soroban contract

![Operator State Proof](./assets/operator-state-proof.svg)

---

## Protocol Diagram

![xMPP Protocol Diagram](./assets/protocol-diagram.svg)

---

## Architecture
```text
apps/
  gateway/          JSON API: fetch, policy preview, wallet state, operator state
  demo-services/    Paid local services with /.well-known/xmpp.json capability docs
  mcp-server/       stdio MCP server for MCP-compatible agent clients
  site/             Product site and operator dashboard

packages/
  router/           Catalog-driven route scoring and workflow estimation
  http-interceptor/ 402 interception, retry, budget snapshots, operator event tracking
  payment-adapters/ x402 and MPP payment execution
  core/             Publishable SDK with gateway client and bootstrap CLI
  policy-engine/    Local and contract-backed policy decisions

contracts/
  xmpp-policy/      Global policy, service policy, agent policy, pause flag, treasury
  xmpp-session-registry/ Session upsert, list, close
```

---

## MCP Tools

xMPP ships a complete MCP server for agent integration:

| Tool | Purpose |
|------|---------|
| `xmpp_fetch` | Payment-aware fetch with automatic route selection |
| `xmpp_policy_preview` | Preview policy decision before paying |
| `xmpp_explain` | Explain the route chosen for a completed call |
| `xmpp_estimate_workflow` | Estimate cost for a multi-step workflow |
| `xmpp_session_list` | List active and recent sessions |
| `xmpp_receipt_verify` | Verify a signed settlement receipt |
| `xmpp_wallet_info` | Current wallet and treasury state |
| `xmpp_agent_profiles` | Agent profile and budget state |

Agent flow: `xmpp_policy_preview` → `xmpp_fetch` → `xmpp_explain` → `xmpp_receipt_verify`

See [agent-flow.md](./docs/agent-flow.md) for the canonical sequence.

---

## Public Packages
```bash
npm install @vinaystwt/xmpp-core @vinaystwt/xmpp-mcp
```

- `@vinaystwt/xmpp-core` — gateway client, route planning, type exports
- `@vinaystwt/xmpp-mcp` — MCP server factory for stdio agent integrations

---

## Quick Start
```bash
pnpm install
cp .env.example .env
pnpm xmpp:bootstrap -- --friendbot
pnpm check
```

Start each service:
```bash
pnpm xmpp:facilitator
pnpm xmpp:services
pnpm xmpp:gateway
pnpm xmpp:mcp
```

Default ports: gateway `4300` · dashboard `4310` · research `4101` · market `4102` · stream `4103`

---

## Required Environment
```bash
XMPP_AGENT_SECRET_KEY=
FACILITATOR_STELLAR_PRIVATE_KEY=
MPP_SECRET_KEY=
```

Generate free Stellar testnet identities:
```bash
stellar keys generate agent && stellar keys secret agent
stellar keys generate facilitator && stellar keys secret facilitator
stellar keys generate mpp-server && stellar keys secret mpp-server
```

Fund with Friendbot:
```bash
curl "https://friendbot.stellar.org/?addr=$(stellar keys address agent)"
curl "https://friendbot.stellar.org/?addr=$(stellar keys address facilitator)"
curl "https://friendbot.stellar.org/?addr=$(stellar keys address mpp-server)"
```

---

## Verification
```bash
pnpm check
pnpm xmpp:smoke
pnpm xmpp:judge:preflight
```

The preflight script exercises all four live routes: x402, mpp-charge, mpp-session-open, mpp-session-reuse, and policy deny.

---

## Smart Account Coverage

x402 settlement runs through the guarded smart-account path. MPP routes use keypair execution in the current verified demo configuration. The guarded fallback preserves live settlement reliability while smart-account coverage is extended route by route.

---

## Docs

- [architecture.md](./docs/architecture.md)
- [router-algorithm.md](./docs/router-algorithm.md)
- [route-economics.md](./docs/route-economics.md)
- [agent-flow.md](./docs/agent-flow.md)
- [api-catalog.md](./docs/api-catalog.md)
- [PROTOCOL.md](./docs/PROTOCOL.md)
- [sdk.md](./docs/sdk.md)
