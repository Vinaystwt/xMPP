import { config } from '@xmpp/config'
import type { Express, Request, Response } from 'express'

export function registerHealthRoute(app: Express) {
  app.get('/health', (_req: Request, res: Response) => {
    res.json({
      ok: true,
      service: 'xmpp-gateway',
      network: config.network,
      paymentExecutionMode: config.paymentExecutionMode,
      services: config.services,
    })
  })
}
