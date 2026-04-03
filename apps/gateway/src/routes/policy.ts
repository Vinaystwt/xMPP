import type { Express, Request, Response } from 'express'
import { createRouter } from '@xmpp/router'
import { evaluatePolicyForRequest } from '@xmpp/policy-engine'

const router = createRouter()

export function registerPolicyRoutes(app: Express) {
  app.get('/policy/preview', async (req: Request, res: Response) => {
    const url = String(req.query.url ?? '')
    const method = String(req.query.method ?? 'GET')
    const serviceId = req.query.serviceId ? String(req.query.serviceId) : undefined
    const projectedRequests = req.query.projectedRequests
      ? Number(req.query.projectedRequests)
      : undefined
    const streaming = req.query.streaming === 'true'

    if (!url) {
      return res.status(400).json({ error: 'query param "url" is required' })
    }

    const policy = await evaluatePolicyForRequest({
      url,
      method,
      serviceId,
    })
    const routePreview = await router.preview({
      url,
      method,
      serviceId,
      projectedRequests,
      streaming,
    })

    res.json({
      policy,
      routePreview,
    })
  })
}
