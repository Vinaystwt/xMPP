# Route Economics

xMPP does not hardcode one payment method. It compares the request shape, service hints, and reusable session state to pick the cheapest viable path that still satisfies policy.

## Decision Inputs

Every route decision considers:

- service capability
- projected request count
- streaming or repeated access
- reusable session availability
- policy and budget constraints

The scoring model then combines:

1. support gate
2. cost delta versus naive x402
3. intent fit
4. service single-call preference
5. session reuse bonus

## Why This Matters

The goal is not to support multiple protocols for its own sake.

The goal is to prevent agents from hardcoding the wrong settlement primitive.

Examples from the current catalog:

### Research API

- request shape: one exact research call
- x402 cost: `$0.01`
- chosen route: `x402`
- why: exact one-off request plus service preference

### Market API

- request shape: one premium quote request
- naive x402 cost: `$0.04`
- mpp-charge cost: `$0.03`
- chosen route: `mpp-charge`
- why: one-shot premium flow plus lower projected cost

### Stream API

- request shape: 5 projected streaming calls
- naive x402 cost: `$0.05`
- mpp-session-open cost: `$0.03`
- chosen route: `mpp-session-open`
- why: repeated access crosses the 4-call break-even threshold and makes session amortization favorable

### Existing Stream Session

- request shape: another 5 calls on an already-open session
- naive x402 cost: `$0.05`
- mpp-session-reuse cost: `$0.025`
- chosen route: `mpp-session-reuse`
- why: the open cost is already paid, so reuse removes the largest source of session overhead

## Session Economics In Plain Terms

MPP session routes are useful because they separate:

- the first session call, which pays setup cost
- later calls, which reuse that setup and keep marginal cost lower

That is what makes repeated or streaming agent workloads economically rational.

## Related Surfaces

These same economics are visible through:

- gateway route previews
- `xmpp_explain`
- `xmpp_estimate_workflow`
- operator state session savings
- dashboard route/session panels
