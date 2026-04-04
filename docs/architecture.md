# xMPP Architecture

xMPP routes paid HTTP requests across x402, MPP charge, and MPP channel/session on Stellar.

Core layers:

1. MCP server for MCP-compatible clients
2. HTTP interceptor + route engine
3. Payment adapters
4. Smart-account wallet control
5. Soroban contracts for policy and session registry
