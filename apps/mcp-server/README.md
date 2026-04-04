# @vinaystwt/xmpp-mcp

xMPP MCP is the public MCP server package for payment-aware agent workflows on Stellar.

It exposes the same route, policy, receipt, and operator surfaces used by the full xMPP stack, but packaged for MCP-compatible clients over stdio.

This is the recommended starting point when your agent client already speaks MCP.

## What It Does

- fetches paid resources through xMPP
- previews route and policy decisions before payment
- explains route scoring and workflow estimates
- lists reusable sessions
- verifies signed receipts
- exposes wallet and operator state to the client

## Install

```bash
npm install @vinaystwt/xmpp-mcp
```

## Tool Surface

The package exposes:

- `xmpp_fetch`
- `xmpp_policy_preview`
- `xmpp_explain`
- `xmpp_estimate_workflow`
- `xmpp_session_list`
- `xmpp_receipt_verify`
- `xmpp_wallet_info`
- `xmpp_agent_profiles`

## Use Case

Use `@vinaystwt/xmpp-mcp` when you want an agent client to:

- call paid APIs through one MCP server
- get route-aware payment execution
- keep receipt and policy state visible
- work with x402, MPP charge, and MPP session flows without embedding that logic directly in the agent

## Related Package

- `@vinaystwt/xmpp-core`
  - SDK and local helper package for direct integration outside MCP

## Docs

- repo:
  - https://github.com/Vinaystwt/xMPP
- SDK docs:
  - https://github.com/Vinaystwt/xMPP/blob/main/docs/sdk.md
