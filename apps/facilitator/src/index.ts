import express from 'express'
import type { NextFunction, Request, Response } from 'express'
import helmet from 'helmet'
import { x402Facilitator } from '@x402/core/facilitator'
import { ExactStellarScheme } from '@x402/stellar/exact/facilitator'
import { createEd25519Signer } from '@x402/stellar'
import { config } from '@xmpp/config'
import { logger } from '@xmpp/logger'
import { getEffectiveSmartAccountFeeCeiling } from '../../../packages/wallet/src/index.js'

export function createFacilitatorApp(): express.Express {
  const app = express()
  app.use(helmet())
  app.use(express.json({ limit: '1mb' }))

  const facilitator = new x402Facilitator()
  facilitator.register(
    config.network as 'stellar:testnet' | 'stellar:pubnet',
    new ExactStellarScheme(
      [
        createEd25519Signer(
          config.x402.facilitatorPrivateKey ?? '',
          config.network as `${string}:${string}`,
        ),
      ],
      {
        rpcConfig: { url: config.rpcUrl },
        areFeesSponsored: true,
        maxTransactionFeeStroops: getEffectiveSmartAccountFeeCeiling(),
      },
    ),
  )

  app.get('/health', (_req: Request, res: Response) => {
    res.json({
      ok: true,
      service: 'xmpp-facilitator',
      network: config.network,
      rpcUrl: config.rpcUrl,
      configuredMaxTransactionFeeStroops: config.x402.maxTransactionFeeStroops,
      effectiveMaxTransactionFeeStroops: getEffectiveSmartAccountFeeCeiling(),
    })
  })

  app.get('/supported', (_req: Request, res: Response) => {
    res.json(facilitator.getSupported())
  })

  app.post('/verify', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { paymentPayload, paymentRequirements } = req.body
      const result = await facilitator.verify(paymentPayload, paymentRequirements)
      res.json(result)
    } catch (error) {
      next(error)
    }
  })

  app.post('/settle', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { paymentPayload, paymentRequirements } = req.body
      const result = await facilitator.settle(paymentPayload, paymentRequirements)
      res.json(result)
    } catch (error) {
      next(error)
    }
  })

  app.use((error: unknown, _req: express.Request, res: express.Response, next: express.NextFunction) => {
    void next
    logger.error({ error }, '[xMPP] facilitator error')
    const message = error instanceof Error ? error.message : 'unknown error'
    res.status(500).json({ error: message })
  })

  return app
}

export function startFacilitator() {
  const app = createFacilitatorApp()
  const port = Number(new URL(config.x402.facilitatorUrl).port || 4022)
  return app.listen(port, () => {
    logger.info({ port }, '[xMPP] facilitator listening')
  })
}

if (import.meta.url === `file://${process.argv[1]}`) {
  startFacilitator()
}
