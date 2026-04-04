# @vinaystwt/xmpp-router

xMPP Router is the route-scoring engine behind payment selection in xMPP.

It evaluates request shape, projected usage, pricing hints, reusable sessions, and policy constraints to choose between:

- `x402`
- `mpp-charge`
- `mpp-session-open`
- `mpp-session-reuse`

## Position In The Package Family

Most builders should start with:

- `@vinaystwt/xmpp-core`
- `@vinaystwt/xmpp-mcp`

Use `@vinaystwt/xmpp-router` directly only if you want route scoring or workflow estimation without the rest of the xMPP gateway stack.

## Install

```bash
npm install @vinaystwt/xmpp-router
```

## Best For

- route previews
- workflow estimation
- custom pricing and capability inspection

## Related Packages

- `@vinaystwt/xmpp-core`
- `@vinaystwt/xmpp-payment-adapters`
- `@vinaystwt/xmpp-types`

## Docs

- repo:
  - https://github.com/Vinaystwt/xMPP
- route algorithm:
  - https://github.com/Vinaystwt/xMPP/blob/main/docs/router-algorithm.md
