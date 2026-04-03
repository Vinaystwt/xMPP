#!/usr/bin/env node

import { runXmppMcpServer } from './server.js'

runXmppMcpServer()
  .then(() => {
    console.error('[xMPP] MCP server running on stdio')
  })
  .catch((error) => {
    console.error('[xMPP] MCP server error', error)
    process.exit(1)
  })
