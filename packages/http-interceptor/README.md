# @vinaystwt/xmpp-http-interceptor

xMPP HTTP Interceptor is the execution engine that turns ordinary HTTP calls into payment-aware calls.

It intercepts `402 Payment Required`, applies policy, chooses adapters, retries the request, records receipts, and updates operator-facing state.

## Position In The Package Family

Most builders should start with:

- `@vinaystwt/xmpp-core`
- `@vinaystwt/xmpp-mcp`

Use `@vinaystwt/xmpp-http-interceptor` directly only if you are building a custom gateway, worker, or middleware layer on top of xMPP internals.

## Install

```bash
npm install @vinaystwt/xmpp-http-interceptor
```

## Best For

- custom HTTP payment middleware
- receipt and operator-state capture
- advanced retry and route-execution control

## Related Packages

- `@vinaystwt/xmpp-payment-adapters`
- `@vinaystwt/xmpp-policy-engine`
- `@vinaystwt/xmpp-router`

## Docs

- repo:
  - https://github.com/Vinaystwt/xMPP
