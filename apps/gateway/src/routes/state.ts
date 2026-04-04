import type { Express, Request, Response } from 'express'
import {
  getTreasurySnapshot,
  listAgentPolicySnapshots,
  listAgentSessions,
  listAgentTreasuryStates,
} from '@xmpp/contract-runtime'
import { getXmppOperatorState, listEffectiveXmppAgentProfiles } from '@xmpp/http-interceptor'
import { getServiceCatalog } from '@xmpp/router'

export function registerStateRoutes(app: Express) {
  app.get('/operator/state', async (_req: Request, res: Response) => {
    const [
      agentProfiles,
      contractSessions,
      contractAgentPolicies,
      contractTreasury,
      contractAgentTreasuryStates,
    ] = await Promise.all([
      listEffectiveXmppAgentProfiles(),
      listAgentSessions(),
      listAgentPolicySnapshots(),
      getTreasurySnapshot(),
      listAgentTreasuryStates(),
    ])
    const localState = getXmppOperatorState(agentProfiles)
    const mergedSessions = new Map(
      localState.openSessions.map((session) => [session.sessionId, session]),
    )
    const contractAgentTreasuryById = new Map(
      contractAgentTreasuryStates.map((state) => [state.agentId, state]),
    )

    for (const session of contractSessions) {
      if (session.status === 'closed') {
        continue
      }

      mergedSessions.set(session.sessionId, {
        sessionId: session.sessionId,
        serviceId: session.serviceId,
        callCount: session.callCount,
      })
    }

    const agentStates = localState.agentStates.map((agent) => {
      const contractState = contractAgentTreasuryById.get(agent.agentId)
      if (!contractState) {
        return agent
      }

      return {
        ...agent,
        spentThisSessionUsd: contractState.spentUsd,
        remainingDailyBudgetUsd: Math.max(0, agent.dailyBudgetUsd - contractState.spentUsd),
      }
    })

    res.json({
      ...localState,
      sharedTreasuryUsd: contractTreasury?.sharedTreasuryUsd ?? localState.sharedTreasuryUsd,
      sharedTreasuryRemainingUsd:
        contractTreasury?.remainingUsd ?? localState.sharedTreasuryRemainingUsd,
      dailyBudgetUsd: contractTreasury?.sharedTreasuryUsd ?? localState.dailyBudgetUsd,
      spentThisSessionUsd: contractTreasury?.totalSpentUsd ?? localState.spentThisSessionUsd,
      remainingDailyBudgetUsd:
        contractTreasury?.remainingUsd ?? localState.remainingDailyBudgetUsd,
      agentStates,
      contractAgentPolicies,
      contractTreasury,
      contractAgentTreasuryStates,
      openSessions: [...mergedSessions.values()],
      contractSessions: contractSessions.filter((session) => session.status !== 'closed'),
    })
  })

  app.get('/catalog', (_req: Request, res: Response) => {
    res.json({
      services: getServiceCatalog(),
    })
  })
}
