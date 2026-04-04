# xMPP Deep Review Prompt For External LLMs

Use this prompt when asking another model such as Claude, Grok, Gemini, Qwen, or similar to deeply review xMPP.

---

You are acting as a combination of:

- a hackathon judge for a Stellar + AI agent payments competition
- a senior product strategist for crypto infrastructure
- a rigorous technical reviewer who cares about demo reliability, differentiation, and submission quality

Your job is to do a deep review of the project below and tell me how to maximize its chance of winning.

You must behave like an expert reviewer, not a hype machine.

Be critical, evidence-driven, and specific.

When possible:

- compare this project to adjacent products or hackathon submissions
- identify strengths, weaknesses, hidden risks, and missing judge-facing proof
- suggest only high-leverage improvements
- optimize for winning probability, not feature count

## Research Instructions

Please do deep research on:

- the current hackathon and its likely judging criteria
- adjacent projects in AI agent payments, x402, MPP, MCP monetization, agent wallets, payment orchestration, smart accounts, and treasury/policy infrastructure
- what kinds of projects usually stand out in crypto hackathons
- what would make this submission feel like infrastructure the ecosystem should adopt

Do not assume the project is incomplete by default.
First read the project details carefully and evaluate the actual built state described below.

## Questions You Must Answer

1. What are the current top strengths of this project?
2. What are the current top weaknesses?
3. What are the most important gaps relative to the hackathon theme and likely judging criteria?
4. What are the best aha features or additions we can still make to increase win probability?
5. What should we absolutely avoid doing in the presentation or submission?
6. What should the pitch positioning be so that this project beats adjacent projects instead of blending into them?
7. What is your honest win probability estimate, with reasoning?
8. If you had to prioritize only the next 3 improvements before submission, what would they be?

## Output Format

Please structure your answer in this order:

1. Executive verdict
2. Top strengths
3. Top weaknesses
4. Competitive positioning
5. Best remaining upgrades
6. Presentation/submission advice
7. Risks to avoid
8. Win probability estimate
9. Final priority list

Use concise but high-signal reasoning.
Be specific.
Do not just give generic hackathon advice.

## Project Name

xMPP

## One-Line Description

xMPP is a payment-routing and control plane for autonomous agents on Stellar.
It intercepts paid HTTP calls, evaluates route economics and policy, and settles using the right primitive:

- x402 for exact one-off calls
- MPP charge for premium one-shot requests
- MPP session/channel reuse for repeated or streaming calls

## Core Thesis

Most agent payment demos show only one settlement path.
xMPP shows that autonomous agents need a payment brain, not just a payment button.

The project’s core idea is:

- agents should not hardcode a payment method
- they should choose the best settlement primitive per request
- operators should retain policy, budget, and audit control
- payment proof and route explainability should be visible

## Why This Project Exists

This project was built for a Stellar hackathon focused on:

- Stellar
- AI agents
- x402
- Stripe MPP / modern payment primitives

The project aims to feel like ecosystem infrastructure, not just a one-off demo.

The intended positioning is:

- payment-routing brain for agentic HTTP calls
- operator control plane for autonomous payments
- verifiable session-economics layer for repeated tool usage

## What Is Actually Built

The repo is real and working, not just a spec.

### Implemented Product Surfaces

- gateway API
- demo services
- MCP server
- operator dashboard
- installable SDK/package surfaces
- Soroban policy and session contracts
- signed receipt verification route
- docs pack
- bootstrap and smoke verification scripts

### Live Payment Flows Implemented

- real Stellar testnet x402
- real Stellar testnet mpp-charge
- real Stellar testnet mpp-session-open
- real Stellar testnet mpp-session-reuse
- policy deny flow
- agent-level deny flow

### MCP / Agent Surfaces Implemented

- `xmpp_fetch`
- `xmpp_agent_profiles`
- `xmpp_wallet_info`
- `xmpp_policy_preview`
- `xmpp_explain`
- `xmpp_session_list`
- `xmpp_estimate_workflow`
- `xmpp_receipt_verify`

### Runtime / Operator Evidence Implemented

- route preview and route scoring
- budget feedback
- treasury tracking
- session tracking
- signed receipts
- receipt verification
- operator state
- explorer URLs / tx evidence
- service capability docs at `/.well-known/xmpp.json`

### Contract Surface Implemented

`contracts/xmpp-policy`

- global policy
- service policy
- agent policy
- pause flag
- shared treasury snapshot
- per-agent treasury state
- treasury spend recording

`contracts/xmpp-session-registry`

- session upsert
- session list
- session close

### Packaging / Release Surface Implemented

- release-ready package metadata
- `@xmpp/core`
- `@xmpp/mcp`
- release pack flow
- SDK docs
- Python and LangChain examples

Public npm publish itself has not happened yet.

## Smart-Account State

Smart-account support exists, but must be described honestly:

- smart-account execution is live for `x402`
- MPP routes still remain keypair-backed
- guarded fallback exists so smart-account x402 failure does not break the product path
- deeper smart-account policy hardening is intentionally deferred

This should not be described as universal smart-account settlement.

## Current Judge-Facing Proof

The project now has real evidence-ready artifacts:

- real Stellar testnet transaction hashes
- explorer links
- signed receipts
- contract-backed treasury state
- contract-backed session state
- smoke verification path
- judge preflight verification path

Latest known real tx examples:

- x402 smart-account example:
  `https://stellar.expert/explorer/testnet/tx/2cc2f8b5388e341e66a5ee68ebd000bf4804d314b82136d091e9b33dbdb37b5b`
- mpp-charge example:
  `https://stellar.expert/explorer/testnet/tx/3125c05d57563e027717cc52eff478c6612cb55fcd57a2eaee21cd5f3241b34e`
- additional x402 smart-account preflight example:
  `https://stellar.expert/explorer/testnet/tx/16c3093215a363b79ed8a5678d9549236b8b7a74f2b818caa3c46d4c5155f1e5`

## Current Verified State

The current pushed branch has passed:

- `pnpm build`
- `pnpm xmpp:smoke`
- `pnpm xmpp:judge:preflight`

This means the following were green together:

- x402
- mpp-charge
- mpp-session-open
- mpp-session-reuse
- deny-before-pay
- smart-account x402
- MPP fallback behavior
- signed receipt evidence

## Key Differentiators

The project should not be judged as generic MCP billing.
Its main differentiators are:

1. multi-route payment orchestration
2. operator policy and budget control
3. visible session economics
4. contract-backed treasury and session evidence
5. explainability through MCP and gateway surfaces

## Important Constraints

Please keep these in mind when reviewing:

- Do not recommend turning this into a generic wallet app.
- Do not recommend making it “just an MCP monetization layer.”
- Do not assume smart-account should be the headline.
- Do not recommend a large architectural rewrite.
- Prefer improvements that increase judge confidence, clarity, and proof.
- Optimize for winning probability and demo quality.

## What We Are Considering Adding Or Improving

Potential remaining work includes:

- stronger submission visuals
- better README proof
- screenshots or GIFs
- final short demo video
- better visual session-lifecycle explanation
- more polished submission narrative
- protocol diagram

## What We Need From You

Give us the sharpest possible review of the project as it exists now.
Tell us:

- what is already strong
- what is still weak
- what we should improve
- what we should avoid
- how we should position it
- and how likely it is to win if presented well

---

If useful, assume the audience includes:

- Stellar Foundation judges
- technically sophisticated crypto builders
- people comparing this project against adjacent Solana or x402 / MCP agent-payment submissions
