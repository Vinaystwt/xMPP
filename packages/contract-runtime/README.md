# @vinaystwt/xmpp-contract-runtime

xMPP Contract Runtime is the Soroban contract client package behind xMPP policy and session-registry integration.

It provides the contract-aware runtime layer used when xMPP reads or updates on-chain policy, treasury, and reusable session state.

## Position In The Package Family

Most builders should start with:

- `@vinaystwt/xmpp-core`
- `@vinaystwt/xmpp-mcp`

Use `@vinaystwt/xmpp-contract-runtime` directly only if you are integrating Soroban contract state into your own xMPP-based service.

## Install

```bash
npm install @vinaystwt/xmpp-contract-runtime
```

## Best For

- reading policy state from the xMPP policy contract
- reading and updating session-registry state
- composing contract-aware treasury or operator workflows

## Related Packages

- `@vinaystwt/xmpp-policy-engine`
- `@vinaystwt/xmpp-wallet`
- `@vinaystwt/xmpp-core`

## Docs

- repo:
  - https://github.com/Vinaystwt/xMPP
