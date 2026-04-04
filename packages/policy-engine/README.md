# @vinaystwt/xmpp-policy-engine

xMPP Policy Engine is the decision layer that keeps agent payments inside operator-defined limits.

It evaluates service allowlists, agent ceilings, treasury state, and contract-backed policy before a payment is allowed to proceed.

## Position In The Package Family

Most builders should start with:

- `@vinaystwt/xmpp-core`
- `@vinaystwt/xmpp-mcp`

Use `@vinaystwt/xmpp-policy-engine` directly only if you need to embed xMPP policy decisions into your own gateway or worker runtime.

## Install

```bash
npm install @vinaystwt/xmpp-policy-engine
```

## Best For

- policy previews before payment
- shared agent and service budget enforcement
- contract-aware treasury control

## Related Packages

- `@vinaystwt/xmpp-contract-runtime`
- `@vinaystwt/xmpp-http-interceptor`
- `@vinaystwt/xmpp-core`

## Docs

- repo:
  - https://github.com/Vinaystwt/xMPP
