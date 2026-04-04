# Demo Script

This is the shortest clean demo path for xMPP.

## Prep

1. Install dependencies.
2. Copy `.env.example` to `.env`.
3. Run bootstrap to generate or persist testnet identities.
4. Start the stack in separate terminals.

```bash
pnpm install
cp .env.example .env
pnpm xmpp:bootstrap -- --dry-run
pnpm xmpp:bootstrap -- --friendbot
pnpm xmpp:facilitator
pnpm xmpp:services
pnpm xmpp:gateway
pnpm xmpp:dashboard
pnpm xmpp:mcp
```

Optional verification:

```bash
pnpm check
cd contracts && cargo test
pnpm xmpp:smoke
pnpm xmpp:demo:smoke
pnpm xmpp:preflight
```

## Demo Flow

Open the dashboard at `http://localhost:4310`.

### 1. x402 exact

```bash
curl -s http://localhost:4300/fetch \
  -H 'content-type: application/json' \
  -d '{
    "url":"http://localhost:4101/research?q=stellar agents",
    "method":"GET",
    "options":{"agentId":"research-agent","serviceId":"research-api","projectedRequests":1}
  }' | jq
```

Callout:

- show `routePreview.route = x402`
- point out that this is the `research-agent` spending from the shared treasury
- show the dashboard event feed update

### 2. MPP charge

```bash
curl -s http://localhost:4300/fetch \
  -H 'content-type: application/json' \
  -d '{
    "url":"http://localhost:4102/quote?symbol=XLM",
    "method":"GET",
    "options":{"agentId":"market-agent","serviceId":"market-api","projectedRequests":1}
  }' | jq
```

Callout:

- show `routePreview.route = mpp-charge`
- point out that this is the `market-agent` using a higher-risk treasury slice
- show budget feedback in the response metadata
- point out that this one-shot charge is intentionally agent-funded while the session flow below is service-sponsored

### 3. MPP session open and reuse

Run twice:

```bash
curl -s http://localhost:4300/fetch \
  -H 'content-type: application/json' \
  -d '{
    "url":"http://localhost:4103/stream/tick",
    "method":"GET",
    "options":{"agentId":"market-agent","serviceId":"stream-api","projectedRequests":5,"streaming":true}
  }' | jq
```

Callout:

- first call opens the session
- second call reuses it
- keep the `market-agent` context visible if you are using the gateway payloads directly
- dashboard session taxi meter increments

### 4. Policy deny

```bash
curl -s http://localhost:4300/fetch \
  -H 'content-type: application/json' \
  -d '{
    "url":"http://localhost:4102/admin/export",
    "method":"GET",
    "options":{"serviceId":"market-api","projectedRequests":1}
  }' | jq
```

Callout:

- request is denied before payment
- dashboard shows the blocked event and denied preview

## Recording Notes

- keep the dashboard visible the whole time
- keep `jq` output large enough to show `payment.route`, `payment.budget`, and `payment.policy`
- after one settled call, verify a signed receipt through `/receipts/verify` or `xmpp_receipt_verify`
- if live testnet hashes are available, click the Stellar Expert link from the event feed
