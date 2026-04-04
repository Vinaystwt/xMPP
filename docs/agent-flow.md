# Agent Flow

xMPP is meant to be used by an agent that plans, pays, and explains its own external calls without hardcoding a single settlement path.

## MCP Tool Sequence

The smallest useful xMPP sequence for an MCP client is:

1. `xmpp_policy_preview`
   - preview whether a request would be allowed and which route xMPP would prefer
2. `xmpp_fetch`
   - execute the paid call through the chosen route
3. `xmpp_explain`
   - inspect why a route won and how its cost compares to naive x402
4. `xmpp_session_list`
   - check whether a reusable MPP session is already open
5. `xmpp_receipt_verify`
   - verify the signed receipt after settlement

That sequence gives the agent both an execution path and an audit path.

## Example Workflow

A simple research-and-quote workflow looks like this:

1. preview a `research-api` lookup
2. settle the exact one-off request through `x402`
3. preview a premium `market-api` quote
4. settle the premium one-shot request through `mpp-charge`
5. preview repeated `stream-api` access
6. open an `mpp-session`
7. reuse the same session on the next stream call
8. verify the signed receipt and inspect the updated operator state

## Gateway-Backed Example

For a concrete agent integration, see:

- `examples/langchain-agent.py`

That example uses the gateway directly so a LangChain agent can:

- run a paid research lookup
- request a premium market quote
- receive xMPP payment metadata in the response
- operate without embedding route-specific payment logic inside the agent
