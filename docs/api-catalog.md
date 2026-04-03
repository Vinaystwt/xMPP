# API Catalog

This is the operator-facing catalog xMPP uses to explain route choice for the demo stack.

Each demo service also exposes a matching discovery document at `/.well-known/xmpp.json`.

## Research API

- Service ID: `research-api`
- Base URL: `http://localhost:4101`
- Endpoint: `GET /research?q=stellar`
- Capability set: `x402`
- Price model: `$0.010` per call
- Route posture: prefers exact x402 for low-friction one-off fetches

Example:

```bash
curl -s http://localhost:4101/research?q=stellar
```

## Market API

- Service ID: `market-api`
- Base URL: `http://localhost:4102`
- Endpoint: `GET /quote?symbol=XLM`
- Capability set: `MPP charge`
- Price model: `$0.030` per call
- Optional mode: server-sponsored gas when `XMPP_ENABLE_MPP_CHARGE_FEE_SPONSORSHIP=true`
- Route posture: premium one-shot quote endpoint that prefers HTTP payment auth over exact settlement

Example:

```bash
curl -s http://localhost:4102/quote?symbol=XLM
```

## Stream API

- Service ID: `stream-api`
- Base URL: `http://localhost:4103`
- Endpoint: `GET /stream/tick`
- Capability set: `MPP session`
- Price model:
  - session open: `$0.005`
  - per commitment: `$0.005`
- Optional mode: server-sponsored gas for channel open and close when `XMPP_ENABLE_MPP_SESSION_FEE_SPONSORSHIP=true`
- Route posture: repeated access crosses the break-even point at 4 calls and then benefits from session reuse

Example:

```bash
curl -s http://localhost:4103/stream/tick
```

## Operator Notes

- Gateway route previews are exposed at `GET /policy/preview`.
- Full operator state is exposed at `GET /operator/state`.
- Signed receipts can be verified through `POST /receipts/verify`.
- MCP tools mirror the same catalog and scoring model through `xmpp_policy_preview`, `xmpp_explain`, and `xmpp_estimate_workflow`.
