# Release Checklist

Use this checklist before sharing or recording the stack.

## Workspace

- `pnpm check`
- `cd contracts && cargo test`
- `pnpm release:pack`

## Live Payment Paths

- `pnpm xmpp:smoke`
- `pnpm xmpp:demo:smoke`
- `pnpm xmpp:preflight`

## Operator Surfaces

- dashboard loads at `http://localhost:4310`
- gateway responds at `http://localhost:4300/health`
- `/operator/state` shows route counts, budget state, and session data
- `/catalog` returns service capabilities and break-even hints

## Proof Artifacts

- at least one live Stellar Expert tx link is available
- signed receipt verification returns `ok: true`
- session reuse shows non-zero `sessionSavingsUsd`
- policy preview blocks the denied `market-api` admin path before payment
