import express from 'express'
import type { Express } from 'express'
import helmet from 'helmet'
import pinoHttpModule from 'pino-http'
import { logger } from '@xmpp/logger'
import { registerHealthRoute } from './routes/health.js'
import { registerFetchRoute } from './routes/fetch.js'
import { registerPolicyRoutes } from './routes/policy.js'
import { registerWalletRoute } from './routes/wallet.js'

const pinoHttp = (pinoHttpModule as unknown as typeof import('pino-http').default)

export function createGatewayApp(): Express {
  const app = express()
  app.use(helmet())
  app.use(express.json({ limit: '1mb' }))
  app.use(pinoHttp({ logger }))

  registerHealthRoute(app)
  registerWalletRoute(app)
  registerPolicyRoutes(app)
  registerFetchRoute(app)

  return app
}
