# @vinaystwt/xmpp-config

xMPP Config is the environment and configuration package used across the xMPP stack.

It loads, validates, and normalizes the settings needed by gateways, payment adapters, wallets, and local tooling.

## Position In The Package Family

Most builders should start with:

- `@vinaystwt/xmpp-core`
- `@vinaystwt/xmpp-mcp`

Use `@vinaystwt/xmpp-config` directly only if you are composing xMPP infrastructure modules yourself.

## Install

```bash
npm install @vinaystwt/xmpp-config
```

## Best For

- validating `XMPP_*`, `MPP_*`, and facilitator environment values
- sharing one configuration shape across multiple xMPP services
- building custom deployment or runtime wrappers around xMPP

## Related Packages

- `@vinaystwt/xmpp-core`
- `@vinaystwt/xmpp-mcp`
- `@vinaystwt/xmpp-wallet`

## Docs

- repo:
  - https://github.com/Vinaystwt/xMPP
