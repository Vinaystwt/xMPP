# Threat Model

xMPP is designed to auto-pay only inside a constrained demo and operator-controlled environment.

## Guardrails In Place

- host allowlist
  - automatic payment is limited to approved local demo hosts
- blocked path prefixes
  - admin, internal, and unsafe paths are denied before any payment attempt
- contract pause flag
  - `xmpp-policy` can halt automatic payment execution globally
- service-level disable
  - `xmpp-policy` can disable a specific service id
- non-GET restriction
  - automatic payment on non-GET routes is rejected unless the policy contract explicitly allows it
- idempotency requirement
  - non-GET autopay requires an idempotency key and rejects replay-key mismatches
- max-autopay ceiling
  - the interceptor will not retry a challenge above the request budget ceiling
- signed receipts
  - settled flows attach signed receipts that can be verified against the agent public key
- runtime fallbacks
  - when contract ids are missing, xMPP falls back to local policy and in-memory session tracking rather than failing closed

## Risks Still Present

- local demo scope
  - allowlists are intentionally narrow and not yet generalized for internet-wide service discovery
- budget enforcement
  - budget feedback is visible to the operator and local daily ceilings are enforced, but deeper contract-backed cumulative spend caps are still lightweight
- smart-account execution
  - key-based execution is live; smart-account signing and policy enforcement are not yet the default settlement path
- external service trust
  - xMPP assumes the paid service exposes an honest payment challenge for the route it supports

## Next Hardening Steps

- add explicit contract-backed service spend caps
- add capability discovery validation before trusting remote `.well-known` metadata
