# @vinaystwt/xmpp-wallet

xMPP Wallet is the execution and receipt-signing package behind xMPP agent payments.

It handles Stellar key material, smart-account-aware execution planning, and signed payment receipts used across the xMPP stack.

## Position In The Package Family

Most builders should start with:

- `@vinaystwt/xmpp-core`
- `@vinaystwt/xmpp-mcp`

Use `@vinaystwt/xmpp-wallet` directly only if you are building custom execution, signing, or wallet-control flows on top of xMPP.

## Install

```bash
npm install @vinaystwt/xmpp-wallet
```

## Best For

- receipt signing and verification inputs
- custom wallet execution paths
- smart-account-aware payment planning

## Related Packages

- `@vinaystwt/xmpp-contract-runtime`
- `@vinaystwt/xmpp-payment-adapters`
- `@vinaystwt/xmpp-core`

## Docs

- repo:
  - https://github.com/Vinaystwt/xMPP
