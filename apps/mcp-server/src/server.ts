import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import * as z from 'zod/v4'
import { listAgentPolicySnapshots, listAgentSessions } from '@xmpp/contract-runtime'
import {
  getXmppMetadata,
  getXmppOperatorState,
  listLocalSessions,
  listEffectiveXmppAgentProfiles,
  xmppFetch,
} from '@xmpp/http-interceptor'
import { createRouter } from '@xmpp/router'
import { getWalletInfo, verifyXmppReceipt } from '@xmpp/wallet'

const router = createRouter()
const signedReceiptSchema = z.object({
  receiptId: z.string(),
  issuedAt: z.string(),
  network: z.string(),
  agent: z.string(),
  serviceId: z.string(),
  url: z.url(),
  method: z.string(),
  route: z.enum(['x402', 'mpp-charge', 'mpp-session-open', 'mpp-session-reuse']),
  amountUsd: z.number(),
  txHash: z.string().optional(),
  explorerUrl: z.url().optional(),
  paymentReference: z.string().optional(),
  signature: z.string(),
})

function safeJson(text: string) {
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

export function createXmppMcpServer(options: { name?: string; version?: string } = {}) {
  let budgetAlertState: 'clear' | 'warning' | 'critical' = 'clear'
  const server = new McpServer({
    name: options.name ?? 'xmpp',
    version: options.version ?? '0.1.0',
  })

  async function maybeSendBudgetAlert(metadata: ReturnType<typeof getXmppMetadata>) {
    const budget = metadata?.budget
    if (!budget) {
      return
    }

    const spent = budget.spentThisSessionUsd
    const remaining = budget.remainingDailyBudgetUsd
    const total = spent + remaining
    if (total <= 0) {
      return
    }

    const ratio = spent / total
    const nextState = ratio >= 1 ? 'critical' : ratio >= 0.8 ? 'warning' : 'clear'
    if (
      nextState === 'clear' ||
      (budgetAlertState === 'warning' && nextState === 'warning') ||
      budgetAlertState === nextState
    ) {
      budgetAlertState = nextState
      return
    }

    budgetAlertState = nextState
    await server.sendLoggingMessage({
      level: nextState === 'critical' ? 'critical' : 'warning',
      logger: 'xmpp-budget',
      data: {
        spentThisSessionUsd: budget.spentThisSessionUsd,
        remainingDailyBudgetUsd: budget.remainingDailyBudgetUsd,
        recommendation: budget.recommendation,
        message:
          nextState === 'critical'
            ? 'xMPP budget exhausted. Pause or raise the operator ceiling before further autopay.'
            : 'xMPP budget has crossed the 80% threshold. Prefer session reuse or stop premium calls.',
      },
    })
  }

  server.registerTool(
    'xmpp_fetch',
    {
      description: 'Fetch a paid resource through xMPP and auto-route payment across x402 or MPP.',
      inputSchema: {
        url: z.url(),
        method: z.string().default('GET'),
        agentId: z.string().optional(),
        serviceId: z.string().optional(),
        projectedRequests: z.number().int().positive().optional(),
        streaming: z.boolean().optional(),
        maxAutoPayUsd: z.number().positive().optional(),
        idempotencyKey: z.string().optional(),
      },
    },
    async ({
      url,
      method,
      agentId,
      serviceId,
      projectedRequests,
      streaming,
      maxAutoPayUsd,
      idempotencyKey,
    }) => {
      const response = await xmppFetch(
        url,
        { method },
        { agentId, serviceId, projectedRequests, streaming, maxAutoPayUsd, idempotencyKey },
      )
      const text = await response.text()
      const metadata = getXmppMetadata(response)
      await maybeSendBudgetAlert(metadata)

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
    'xmpp_agent_profiles',
    {
      description: 'List xMPP shared-treasury agents, their budgets, and their current spend.',
    },
    async () => {
      const profiles = await listEffectiveXmppAgentProfiles()
      const result = {
        profiles,
        contractPolicies: await listAgentPolicySnapshots(),
        state: getXmppOperatorState(profiles).agentStates,
      }

      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        structuredContent: result,
      }
    },
  )

  server.registerTool(
    'xmpp_receipt_verify',
    {
      description: 'Verify a signed xMPP payment receipt against the agent public key.',
      inputSchema: {
        receipt: signedReceiptSchema,
      },
    },
    async ({ receipt }) => {
      const result = verifyXmppReceipt(receipt)
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        structuredContent: result,
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

  server.registerTool(
    'xmpp_explain',
    {
      description: 'Explain how xMPP scores routes for a request, including cost and break-even context.',
      inputSchema: {
        url: z.url(),
        method: z.string().default('GET'),
        serviceId: z.string().optional(),
        projectedRequests: z.number().int().positive().optional(),
        streaming: z.boolean().optional(),
        hasReusableSession: z.boolean().optional(),
      },
    },
    async ({ url, method, serviceId, projectedRequests, streaming, hasReusableSession }) => {
      const explanation = router.explain({
        url,
        method,
        serviceId,
        projectedRequests,
        streaming,
        hasReusableSession,
      })

      return {
        content: [{ type: 'text', text: JSON.stringify(explanation, null, 2) }],
        structuredContent: explanation,
      }
    },
  )

  server.registerTool(
    'xmpp_session_list',
    {
      description: 'List local and contract-backed xMPP sessions for the current agent.',
    },
    async () => {
      const localSessions = listLocalSessions()
      const contractSessions = await listAgentSessions()
      const merged = new Map(localSessions.map((session) => [session.sessionId, session]))

      for (const session of contractSessions) {
        merged.set(session.sessionId, session)
      }

      const result = {
        totalSessions: merged.size,
        localSessions,
        contractSessions,
        sessions: [...merged.values()],
      }

      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        structuredContent: result,
      }
    },
  )

  server.registerTool(
    'xmpp_estimate_workflow',
    {
      description: 'Estimate multi-step workflow cost, selected routes, and savings against naive x402.',
      inputSchema: {
        steps: z.array(
          z.object({
            url: z.url(),
            method: z.string().default('GET').optional(),
            serviceId: z.string().optional(),
            projectedRequests: z.number().int().positive(),
            streaming: z.boolean().optional(),
          }),
        ),
      },
    },
    async ({ steps }) => {
      const estimate = router.estimateWorkflow(steps)
      return {
        content: [{ type: 'text', text: JSON.stringify(estimate, null, 2) }],
        structuredContent: estimate,
      }
    },
  )

  return server
}

export async function runXmppMcpServer(options?: { name?: string; version?: string }) {
  const server = createXmppMcpServer(options)
  const transport = new StdioServerTransport()
  await server.connect(transport)
  return server
}
