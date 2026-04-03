# xMPP Protocol v0.1

xMPP is a payment-routing layer for agentic HTTP calls on Stellar.

## 1. Request Model

An agent issues a normal HTTP request through xMPP with optional routing hints:

- `serviceId`
- `projectedRequests`
- `streaming`

xMPP evaluates policy before attempting payment.

## 2. Capability Model

Services are represented in a catalog with:

- service id
- supported payment modes
- pricing hints
- break-even threshold
- preferred single-call route

The current demo stack exposes this shape through `/.well-known/xmpp.json`, while the router still prefers its local catalog for deterministic demos.

## 3. 402 Handling

When a service returns `402 Payment Required`, xMPP:

1. parses the payment challenge
2. resolves the applicable service catalog entry
3. scores candidate routes
4. prepares the chosen payment adapter
5. retries the request with the payment headers or SDK flow required by that protocol

## 4. Session Lifecycle

MPP session routes use two phases:

- `mpp-session-open`
  - first paid call that creates or activates the channel lifecycle
- `mpp-session-reuse`
  - later calls that reuse the same session and avoid paying the open cost again

Session events are recorded locally for operator visibility and can also be written to the `xmpp-session-registry` Soroban contract.

## 5. Policy Surface

The `xmpp-policy` contract exposes:

- global policy
- service policy
- pause flag

Runtime policy falls back to local rules when contract ids are absent.

## 6. Operator Feedback

Every paid request can expose:

- route selected
- retry metadata
- payment execution status
- budget snapshot
- policy decision

That same data is surfaced through:

- gateway JSON responses
- MCP tools
- dashboard event history
