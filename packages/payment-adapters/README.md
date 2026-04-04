# @vinaystwt/xmpp-payment-adapters

xMPP Payment Adapters is the settlement layer behind xMPP route execution.

It contains the adapter implementations for:

- `x402`
- `mpp-charge`
- `mpp-session-open`
- `mpp-session-reuse`

## Position In The Package Family

Most builders should start with:

- `@vinaystwt/xmpp-core`
- `@vinaystwt/xmpp-mcp`

Use `@vinaystwt/xmpp-payment-adapters` directly only if you need low-level control over settlement execution in a custom xMPP service.

## Install

```bash
npm install @vinaystwt/xmpp-payment-adapters
```

## Best For

- custom settlement execution
- adapter-level testing
- embedding x402 and MPP execution into your own payment pipeline

## Related Packages

- `@vinaystwt/xmpp-http-interceptor`
- `@vinaystwt/xmpp-wallet`
- `@vinaystwt/xmpp-router`

## Docs

- repo:
  - https://github.com/Vinaystwt/xMPP
