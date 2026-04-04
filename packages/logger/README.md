# @vinaystwt/xmpp-logger

xMPP Logger is the shared structured logging package used across xMPP services and libraries.

It keeps gateway, service, SDK, and runtime logs consistent across the stack.

## Position In The Package Family

Most builders should start with:

- `@vinaystwt/xmpp-core`
- `@vinaystwt/xmpp-mcp`

Use `@vinaystwt/xmpp-logger` directly only if you want the same logging conventions in custom xMPP-adjacent tooling.

## Install

```bash
npm install @vinaystwt/xmpp-logger
```

## Best For

- shared JSON logging across xMPP services
- keeping local tooling aligned with xMPP log output

## Related Packages

- `@vinaystwt/xmpp-config`
- `@vinaystwt/xmpp-core`

## Docs

- repo:
  - https://github.com/Vinaystwt/xMPP
