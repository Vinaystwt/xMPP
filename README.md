# xMPP

The ultimate x402 ↔ MPP brain for autonomous agents on Stellar.

xMPP is a hackathon submission stack for the Stellar Agents x402 + Stripe MPP track.

It gives an autonomous agent one payment-aware fetch path that can:

- call a paid tool normally
- receive HTTP 402 Payment Required
- evaluate route + safety policy
- auto-settle through x402, MPP charge, or MPP session/channel
- retry automatically
- expose route metadata to operators and MCP clients

## Current Status

Implemented now:

- Smart routing between x402 and MPP
- HTTP interceptor with retry + route metadata
- MCP server for Claude/Codex
- Demo services for x402, MPP charge, and MPP session
- Gateway API for fetch, wallet state, and policy preview
- Operator dashboard at `apps/dashboard`
- Safety deny flow before payment execution
- Soroban contract workspace plus testnet deploy script

Still blocked on live completion:

- real Stellar testnet secrets
- deployed one-way MPP channel contract id
- smart-account transaction execution beyond config placeholders

## Repo Layout

- `apps/gateway`: API surface for xMPP fetches and operator endpoints
- `apps/demo-services`: paid demo services for x402, MPP charge, and MPP session
- `apps/mcp-server`: stdio MCP server exposing xMPP tools
- `apps/dashboard`: operator dashboard for demo visibility
- `packages/router`: route selection logic
- `packages/http-interceptor`: 402 interception, policy, retry, session reuse
- `packages/payment-adapters`: x402 and MPP payment clients
- `packages/wallet`: wallet readiness and smart-account config surface
- `packages/policy-engine`: local allow/deny logic for demo safety
- `contracts`: Soroban workspace for xMPP policy and session registry contracts

## What Is Real vs Mocked

- `x402`: service-side wiring is real and testnet-oriented
- `MPP charge`: service-side and client-side wiring are real and testnet-oriented
- `MPP session/channel`: live code path exists, but the demo falls back to a mock session challenge until `MPP_CHANNEL_CONTRACT_ID` is configured
- `smart-account`: config defaults exist, but full on-chain smart-account execution is not finished yet
- `contracts`: workspace builds and deploy script exists, but contracts are not yet wired into runtime decisions

## Required Inputs From You

To finish live testnet settlement, I need these values from you:

1. `XMPP_AGENT_SECRET_KEY`
2. `FACILITATOR_STELLAR_PRIVATE_KEY`
3. `MPP_SECRET_KEY`

You can generate them with:

```bash
stellar keys generate agent
stellar keys generate facilitator
stellar keys generate mpp-server

stellar keys secret agent
stellar keys secret facilitator
stellar keys secret mpp-server
```

Fund the relevant addresses for free:

```bash
curl "https://friendbot.stellar.org/?addr=$(stellar keys address agent)"
curl "https://friendbot.stellar.org/?addr=$(stellar keys address facilitator)"
curl "https://friendbot.stellar.org/?addr=$(stellar keys address mpp-server)"
```

I will also eventually need:

- `X402_RECIPIENT_ADDRESS`
- `MPP_RECIPIENT_ADDRESS`
- `MPP_CHANNEL_CONTRACT_ID`

## Local Setup

```bash
pnpm install
cp .env.example .env
pnpm check
```

## Start The Stack

Run each process in its own terminal:

```bash
pnpm xmpp:services
pnpm xmpp:gateway
pnpm xmpp:dashboard
pnpm xmpp:mcp
```

Default ports:

- Gateway: `http://localhost:4300`
- Dashboard: `http://localhost:4310`
- Research API: `http://localhost:4101`
- Market API: `http://localhost:4102`
- Stream API: `http://localhost:4103`

## Gateway Endpoints

- `GET /health`
- `GET /wallet`
- `GET /policy/preview?url=...`
- `POST /fetch`

Example fetch through xMPP:

```bash
curl -s http://localhost:4300/fetch \
  -H 'content-type: application/json' \
  -d '{
    "url":"http://localhost:4101/research?q=stellar",
    "method":"GET",
    "options":{"serviceId":"research-api","projectedRequests":1}
  }' | jq
```

## MCP Tools

The MCP server exposes:

- `xmpp_fetch`
- `xmpp_wallet_info`
- `xmpp_policy_preview`

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

This writes deployed ids to `contracts/scripts/addresses.json`.

## Demo Outline

Target demo flow:

1. Low-volume research request routes to x402.
2. Premium quote request routes to MPP charge.
3. Repeated stream request routes to MPP session/channel.
4. Unsafe admin request is denied by xMPP policy before payment.

See `docs/architecture.md` for the working design.
