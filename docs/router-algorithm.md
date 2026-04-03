# Router Algorithm

xMPP uses a service catalog plus a small scoring model instead of a hardcoded `if/else` route switch.

## Inputs

Each decision uses:

- request URL
- HTTP method
- service id when known
- projected request count
- streaming intent
- reusable session availability

The catalog contributes:

- supported payment modes
- per-route price assumptions
- a break-even threshold
- a preferred single-call route

## Cost Model

For a service with catalog entry `S` and projected request count `N`:

- `x402 = N * S.pricing.x402PerCallUsd`
- `mpp-charge = N * S.pricing.mppChargePerCallUsd`
- `mpp-session-open = S.pricing.mppSessionOpenUsd + N * S.pricing.mppSessionPerCallUsd`
- `mpp-session-reuse = N * S.pricing.mppSessionPerCallUsd`

The router keeps a naive `x402` baseline for comparison so it can report savings or penalties for the chosen route.

## Score Components

Every candidate route gets:

1. support gate
   - unsupported modes get a negative score immediately
2. cost delta
   - cheaper than naive x402 increases score
   - more expensive than naive x402 decreases score
3. intent fit
   - x402 gets a bonus for single exact calls
   - MPP charge gets a bonus for premium one-shot flows
   - MPP session gets a bonus for streaming and repeated access
4. catalog preference
   - services can mark a preferred single-call route
5. session reuse bonus
   - reusing an open session gets an extra boost because the channel open cost is already amortized

## Break-Even Logic

For `stream-api`, the catalog break-even threshold is `4` calls:

- below 4 calls, the router still sees session setup overhead
- at or above 4 calls, session economics become favorable
- once a session exists, `mpp-session-reuse` removes the open cost from later requests

## Outputs

The router returns:

- chosen route
- primary reason string
- score
- estimated total cost
- savings versus naive x402
- full per-route breakdown

That same explanation powers:

- gateway preview responses
- MCP `xmpp_explain`
- MCP `xmpp_estimate_workflow`
- dashboard route and budget panels
