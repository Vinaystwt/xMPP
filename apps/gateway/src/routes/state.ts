import type { Express, Request, Response } from 'express'
import { listAgentPolicySnapshots, listAgentSessions } from '@xmpp/contract-runtime'
import { getXmppOperatorState, listEffectiveXmppAgentProfiles } from '@xmpp/http-interceptor'
import { getServiceCatalog } from '@xmpp/router'

export function registerStateRoutes(app: Express) {
  app.get('/operator/state', async (_req: Request, res: Response) => {
    const [agentProfiles, contractSessions, contractAgentPolicies] = await Promise.all([
      listEffectiveXmppAgentProfiles(),
      listAgentSessions(),
      listAgentPolicySnapshots(),
    ])
    const localState = getXmppOperatorState(agentProfiles)
    const mergedSessions = new Map(
      localState.openSessions.map((session) => [session.sessionId, session]),
    )

    for (const session of contractSessions) {
      mergedSessions.set(session.sessionId, {
        sessionId: session.sessionId,
        serviceId: session.serviceId,
        callCount: session.callCount,
      })
    }

    res.json({
      ...localState,
      contractAgentPolicies,
      openSessions: [...mergedSessions.values()],
      contractSessions,
    })
  })

  app.get('/catalog', (_req: Request, res: Response) => {
    res.json({
      services: getServiceCatalog(),
    })
  })
}
