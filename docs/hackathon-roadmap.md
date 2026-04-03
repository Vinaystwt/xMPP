# xMPP Hackathon Roadmap

Updated: 2026-04-03

## Verified Baseline

- Local `main` and GitHub `main` are synced at `223099c79e495e34f9490180c55f31de8325c638`.
- `pnpm check` passes.
- `cargo test` passes.
- `pnpm xmpp:smoke` succeeds in `testnet` mode.
- Real testnet settlement has been verified locally for:
  - `x402`
  - `mpp-charge`
  - `mpp-session-open`
  - `mpp-session-reuse`
- The policy deny flow works before payment execution.
- Soroban contracts now expose real policy and session registry methods with tests.
- Runtime contract wiring is now live and reads policy from deployed testnet contracts.

## Progress Snapshot

Completed on 2026-04-03:

- contract runtime package and gateway/operator wiring
- deployed testnet policy and session registry contracts
- catalog-driven router scoring with workflow estimation
- MCP `xmpp_explain`, `xmpp_session_list`, `xmpp_estimate_workflow`, and `xmpp_receipt_verify`
- operator dashboard redesign with logo, budget panels, fee-sponsorship status, session feed, and route matrix
- docs pack:
  - `api-catalog.md`
  - `router-algorithm.md`
  - `demo-script.md`
  - `threat-model.md`
  - `PROTOCOL.md`
- GitHub Actions for monorepo checks and contracts
- Python gateway example
- LangChain gateway example
- `/.well-known/xmpp.json` capability documents on demo services
- signed receipts and receipt verification route
- one-command bootstrap with dry-run and Friendbot options
- optional MPP fee sponsorship wiring and wallet/dashboard visibility
- budget notifications and budget feedback in MCP fetch responses
- installable `@xmpp/core` SDK surface with gateway client and `xmpp-demo bootstrap` CLI
- publishable `@xmpp/mcp` package surface with exported MCP server factory
- shared treasury agents with per-agent budgets and route and service restrictions

Still open from the larger suggestion backlog:

- screenshots or GIF capture
- final demo video link
- deeper smart-account execution
- dedicated fee-sponsored live scenario
- deeper contract-backed multi-agent treasury controls

## Claude Review Reconciled

The Claude review was useful, but part of it is now stale.

Already done or disproven:

- Real Stellar testnet transactions were described as missing. They are now verified by the integrated smoke flow.
- Gateway, MCP server, dashboard, router, interceptor, facilitator, and demo services already exist.
- The startup docs now include the local facilitator.

Still valid and worth doing:

- Wire the new Soroban contracts into runtime reads and writes.
- Replace the hardcoded router heuristic with a service catalog plus scoring formula.
- Add the missing MCP tools that make the "payment brain" visible.
- Add missing docs for the demo, routing logic, protocol, and threat model.
- Improve presentation quality: frontend polish, logo, screenshots, explorer links, cleaner README.

## Copilot Findings

As of 2026-04-03, the overlap around agent payments and MCP monetization is real.

Relevant adjacent builder projects from the Copilot corpus:

- `latinum-agentic-commerce` focuses on MCP-compatible wallets and autonomous tool payments.
- `mcpay` focuses on x402-based MCP tool billing and already won a Stablecoins track prize.
- `mercantill` focuses on audit trails and spending controls for AI-agent banking.
- `xaam` focuses on agent marketplaces and MCP-based agent capability sharing.

This means xMPP should not present itself as "MCP payments" in the abstract. That lane is already occupied. The differentiators worth doubling down on are:

- route selection across multiple payment primitives, not only x402
- policy and auditability for autonomous payments
- verifiable session economics and session reuse
- operator-grade visibility instead of only a developer demo

Archive guidance points in the same direction:

- Sam Broner argues that agent payments will need unified purchase and approval views, not fragmented vendor-by-vendor flows.
- Christian Crowley argues that agent systems need strong user control and policy boundaries.
- Galaxy Research frames MCP, x402, and agent-payment primitives as foundational infrastructure rather than app-layer features.

Those three points reinforce the same product posture for xMPP:

- payment orchestration
- user/operator control
- standards-shaped developer experience

## Claude Suggestions Ledger

This section exists to make sure every concrete suggestion from the earlier Claude review is captured somewhere in the internal plan, even when it is not on the immediate critical path.

### Already Done Or Materially Addressed

- real testnet payment execution is no longer hypothetical; the smoke path verifies `x402`, `mpp-charge`, `mpp-session-open`, and `mpp-session-reuse`
- contract stubs have been replaced with real policy/session-registry methods plus tests
- startup docs now include the local facilitator that the real x402 path depends on
- integrated smoke verification now proves session open and session reuse explicitly

### Must Capture In Submission-Critical Work

- runtime contract wiring:
  - read policy from `xmpp-policy`
  - write session lifecycle events to `xmpp-session-registry`
- router upgrade:
  - service catalog
  - scoring formula
  - break-even math
  - route explanation output
- missing MCP tools:
  - `xmpp_session_list`
  - `xmpp_explain`
  - `xmpp_estimate_workflow`
- proof and audit surface:
  - explorer links for payment txs
  - explicit channel lifecycle visibility: open, pay, reuse, settle
  - session savings visibility
- safety hardening:
  - enforce allowlists
  - cap spends
  - disable unknown `POST` autopay
  - add idempotency cache
  - redact secrets in logs
  - validate env on boot
- docs:
  - `docs/demo-script.md`
  - `docs/router-algorithm.md`
  - `docs/threat-model.md`
  - `docs/PROTOCOL.md`
  - `docs/api-catalog.md`
- repo and submission polish:
  - GitHub Actions for JS and contracts
  - repo description
  - working README badges
  - screenshot or GIF
  - final demo video link
  - freeze demo env values
- presentation:
  - sexy dashboard redesign
  - logo
  - stronger operator-facing route/session/budget visibility

### Should Capture If Core Story Is Stable

- budget feedback loop in `xmpp_fetch` responses
- MCP budget notifications
- taxi-meter view for MPP channels
- Python or LangChain example
- `.well-known/xmpp.json` capability discovery
- demo reset/bootstrap scripts and a cleaner `xmpp:demo` flow
- stronger dashboard event history and payment receipts presentation

### Nice To Have But Explicitly Tracked

- signed verifiable payment receipts
- one-command developer experience
- npm packaging and SDK surfaces
- fee sponsorship demo
- multi-agent shared treasury
- full smart-account execution beyond the current readiness/config layer
- broader non-Claude agent integrations beyond a single Python example

## Must Add

These are the items most likely to change how xMPP is perceived relative to adjacent projects.

### 1. Differentiation Through Proof

- Keep the real `x402`, `mpp-charge`, `mpp-session-open`, and `mpp-session-reuse` flows working in the smoke path.
- Surface testnet transaction evidence directly in the dashboard and README.
- Make channel open vs reuse vs settle visible, not implicit.

### 2. Operator Controls

- Wire the new policy contract into runtime reads.
- Add explicit budget ceilings and service-level policy decisions.
- Add session registry writes so session state is inspectable instead of only in-memory.
- Add idempotency and safer autopay defaults for non-demo traffic.
- Add env validation and secret redaction so the repo behaves predictably under judge setup.

### 3. The Brain, Not A Wrapper

- Replace hardcoded route choices with a real scoring model.
- Add `xmpp_explain` so the system can justify its own decision.
- Add `xmpp_estimate_workflow` so agents can plan before spending.

### 4. Presentability

- Upgrade the dashboard to look like infrastructure software, not scaffolding.
- Add a logo and a more intentional visual identity.
- Add screenshots and explorer-linked evidence to the repo.
- Add a final demo video link once recording is done.

## Should Add

These are strong improvements once the must-add list is stable.

### 1. Session And Budget Intelligence

- Add a live taxi-meter view for MPP sessions.
- Return budget feedback in fetch responses.
- Add MCP budget notifications when thresholds are crossed.

### 2. Submission And Adoption Surface

- Add a Python or LangChain example that calls the gateway.
- Add `docs/PROTOCOL.md` describing xMPP as a protocol shape, not just an app.
- Add CI workflows and a clean quickstart so a judge can boot the repo without hunting.
- Add `docs/api-catalog.md` so the gateway, MCP tools, and demo services are legible at a glance.
- Add repo metadata cleanup: description, badges, screenshots, and working quick links.

### 3. Capability Discovery

- Add `.well-known/xmpp.json` service capability discovery and cache it.
- Use it to enrich the router catalog over time.
- Add a clearer path to a one-command demo bootstrap if time allows.

## Nice To Have

These help, but they are not on the shortest path to a complete submission.

- signed receipts
- one-command bootstrap
- npm packaging and SDK surfaces
- fee sponsorship demo
- smart-account execution beyond the current readiness layer
- deeper multi-agent treasury controls

## Must Ship

These are the highest-value items for credibility with judges.

### 1. Runtime Contract Wiring

- Read global and service policy from `xmpp-policy`.
- Write session open/reuse/close events into `xmpp-session-registry`.
- Add a simple fallback to local/in-memory logic when contract IDs are absent.

### 2. Router Credibility

- Introduce a service catalog instead of `serviceId === 'market-api'`.
- Implement route scoring using projected calls, streaming intent, and break-even thresholds.
- Document the scoring formula in `docs/router-algorithm.md`.

### 3. Missing MCP Surface

- Add `xmpp_session_list`.
- Add `xmpp_explain`.
- Add `xmpp_estimate_workflow`.

### 4. Submission-Grade Docs

- `docs/demo-script.md`
- `docs/router-algorithm.md`
- `docs/threat-model.md`
- `docs/PROTOCOL.md`

### 5. CI And Repo Hygiene

- Add `.github/workflows/ci.yml`.
- Add `.github/workflows/contracts.yml`.
- Freeze `.env.example` to the verified demo shape.
- Add repo description, correct README links, and include smoke/demo commands.

## High-Impact Polish

These materially increase win probability once the must-ship items are stable.

### Frontend And Brand

- Redesign the dashboard to look intentional and demo-ready, not only functional.
- Add an xMPP logo and brand lockup.
- Add a hero section that explains the route brain in one glance.
- Show event history, route choice, spend totals, and session state clearly.
- Show the protocol split explicitly: `x402`, `MPP charge`, `MPP session open`, `MPP session reuse`.
- Add a screenshot or short GIF to the README.

### Demo Visibility

- Add Stellar Explorer links for every transaction hash.
- Add a live "taxi meter" for MPP channel usage:
  - commitments
  - cumulative spend
  - channel balance remaining
  - savings vs naive x402

### Agent Budget Awareness

- Return budget metadata from `xmpp_fetch`.
- Show projected repeat-call cost and route recommendation.
- Add MCP budget notifications if feasible.
- Add an operator view for daily spend, service spend, and session savings.

## Strong Stretch Features

Only take these on after the must-ship track is stable.

- explicit fee-sponsored live scenario
- publish the installable package set after a final versioning pass

## Deferred Unless There Is Slack

- full smart-account execution beyond the current config and readiness surface
- deeper contract-backed multi-agent treasury controls

These are strong ideas, but they are not the shortest path to a winning demo.

## Execution Order

### Phase 1: Lock The Core Story

1. Wire policy and session contracts into runtime.
2. Replace the router heuristic with catalog-driven scoring.
3. Add MCP explain/list/estimate tools.
4. Persist enough session and budget state for the dashboard to show real operator intelligence.
5. Add the missing safety hardening that makes autonomous payments defensible.

### Phase 2: Make The Demo Legible

1. Ship `docs/demo-script.md`.
2. Add explorer links and session telemetry to the dashboard.
3. Redesign the dashboard and add logo/branding.
4. Add a screenshot/GIF to the README.
5. Add `docs/api-catalog.md` and tighten repo metadata.

### Phase 3: Make The Agent Feel Smart

1. Add budget feedback to fetch responses.
2. Add workflow estimation.
3. Add optional MCP notifications for budget thresholds.
4. Add `xmpp_session_list` and richer route/session explanation views.

### Phase 4: Submission Polish

1. Add CI.
2. Clean README and repo metadata.
3. Add screenshots, video link, and protocol/threat docs.
4. Freeze the demo env and add reset/bootstrap notes for recording day.

### Phase 5: Stretch Only If Stable

1. dedicated fee-sponsored live scenario
2. deeper contract-backed treasury controls
3. smart-account default execution

## Current Recommendation

Do not chase every idea in parallel.

The most credible path to a strong submission is:

1. contract wiring
2. router scoring
3. missing MCP tools
4. session and budget visibility
5. dashboard redesign plus explorer visibility
6. docs and demo script
7. CI and README polish
