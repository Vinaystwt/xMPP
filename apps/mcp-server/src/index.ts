import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import * as z from 'zod/v4'
import { xmppFetch, getXmppMetadata } from '@xmpp/http-interceptor'
import { createRouter } from '@xmpp/router'
import { getWalletInfo } from '@xmpp/wallet'

const router = createRouter()

const server = new McpServer({
  name: 'xmpp',
  version: '0.1.0',
})

server.registerTool(
  'xmpp_fetch',
  {
    description: 'Fetch a paid resource through xMPP and auto-route payment across x402 or MPP.',
    inputSchema: {
      url: z.url(),
      method: z.string().default('GET'),
      serviceId: z.string().optional(),
      projectedRequests: z.number().int().positive().optional(),
      streaming: z.boolean().optional(),
    },
  },
  async ({ url, method, serviceId, projectedRequests, streaming }) => {
    const response = await xmppFetch(
      url,
      { method },
      { serviceId, projectedRequests, streaming },
    )
    const text = await response.text()
    const metadata = getXmppMetadata(response)

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              status: response.status,
              payment: metadata,
              body: safeJson(text),
            },
            null,
            2,
          ),
        },
      ],
      structuredContent: {
        status: response.status,
        payment: metadata,
        body: safeJson(text),
      },
    }
  },
)

server.registerTool(
  'xmpp_wallet_info',
  {
    description: 'Return current xMPP wallet status.',
  },
  async () => {
    const wallet = await getWalletInfo()
    return {
      content: [{ type: 'text', text: JSON.stringify(wallet, null, 2) }],
      structuredContent: wallet,
    }
  },
)

server.registerTool(
  'xmpp_policy_preview',
  {
    description: 'Preview the payment route xMPP would choose without paying.',
    inputSchema: {
      url: z.url(),
      method: z.string().default('GET'),
      serviceId: z.string().optional(),
      projectedRequests: z.number().int().positive().optional(),
      streaming: z.boolean().optional(),
    },
  },
  async ({ url, method, serviceId, projectedRequests, streaming }) => {
    const preview = await router.preview({
      url,
      method,
      serviceId,
      projectedRequests,
      streaming,
    })

    return {
      content: [{ type: 'text', text: JSON.stringify(preview, null, 2) }],
      structuredContent: preview,
    }
  },
)

function safeJson(text: string) {
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

async function main() {
  const transport = new StdioServerTransport()
  await server.connect(transport)
  console.error('[xMPP] MCP server running on stdio')
}

main().catch((error) => {
  console.error('[xMPP] MCP server error', error)
  process.exit(1)
})
