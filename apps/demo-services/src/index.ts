import express from 'express'
import { config } from '@xmpp/config'
import { paymentMiddlewareFromConfig } from '@x402/express'
import { HTTPFacilitatorClient } from '@x402/core/server'
import { ExactStellarScheme } from '@x402/stellar/exact/server'
import { Mppx as MppxCharge, Store as ChargeStore, stellar as mppCharge } from '@stellar/mpp/charge/server'
import {
  Mppx as MppxChannel,
  Store as ChannelStore,
  stellar as mppChannel,
} from '@stellar/mpp/channel/server'
import { Keypair } from '@stellar/stellar-sdk'
import { XLM_SAC_TESTNET } from '@xmpp/payment-adapters'

const stellarNetwork = config.network as 'stellar:testnet' | 'stellar:pubnet'

function toWebRequest(req: express.Request) {
  const headers = new Headers()
  for (const [key, value] of Object.entries(req.headers)) {
    if (value == null) continue
    if (Array.isArray(value)) {
      for (const entry of value) {
        headers.append(key, entry)
      }
      continue
    }

    headers.set(key, value)
  }

  return new Request(`http://${req.headers.host ?? 'localhost'}${req.originalUrl}`, {
    method: req.method,
    headers,
  })
}

async function sendWebResponse(res: express.Response, response: Response) {
  response.headers.forEach((value, key) => {
    res.setHeader(key, value)
  })

  const text = await response.text()
  res.status(response.status).send(text)
}

function createX402FacilitatorClient() {
  return new HTTPFacilitatorClient({
    url: config.x402.facilitatorUrl,
    createAuthHeaders: config.x402.facilitatorApiKey
      ? async () => ({
          verify: { Authorization: `Bearer ${config.x402.facilitatorApiKey}` },
          settle: { Authorization: `Bearer ${config.x402.facilitatorApiKey}` },
          supported: { Authorization: `Bearer ${config.x402.facilitatorApiKey}` },
        })
      : undefined,
  })
}

export function createResearchApp(): express.Express {
  const app = express()
  app.use(
    paymentMiddlewareFromConfig(
      {
        'GET /research': {
          accepts: {
            scheme: 'exact',
            network: stellarNetwork,
            payTo: config.x402.recipientAddress ?? '',
            price: {
              asset: XLM_SAC_TESTNET,
              amount: '100000',
            },
          },
          description: 'xMPP research route protected by real x402 on Stellar testnet.',
        },
      },
      createX402FacilitatorClient(),
      [{ network: stellarNetwork, server: new ExactStellarScheme() }],
      undefined,
      undefined,
    ),
  )

  app.get('/research', (req: express.Request, res: express.Response) => {
    res.json({
      service: 'research-api',
      route: req.header('x-xmpp-route') ?? 'x402',
      result: `Research result for ${req.query.q ?? 'stellar'}`,
    })
  })

  return app
}

export function createMarketApp(): express.Express {
  const app = express()
  const payments = MppxCharge.create({
    secretKey: config.mpp.secretKey,
    methods: [
      mppCharge.charge({
        recipient: config.mpp.recipientAddress ?? '',
        currency: XLM_SAC_TESTNET,
        network: stellarNetwork,
        store: ChargeStore.memory(),
      }),
    ],
  })

  app.get('/quote', async (req: express.Request, res: express.Response) => {
    const result = await payments.charge({
      amount: '0.03',
      description: 'Premium quote',
    })(toWebRequest(req))

    if (result.status === 402) {
      return sendWebResponse(res, result.challenge)
    }

    return sendWebResponse(
      res,
      result.withReceipt(
        Response.json({
          service: 'market-api',
          route: req.header('x-xmpp-route') ?? 'mpp-charge',
          symbol: req.query.symbol ?? 'XLM',
          price: '0.1245',
        }),
      ),
    )
  })

  return app
}

function createMockStreamApp(): express.Express {
  const app = express()
  app.get('/stream/tick', (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (req.header('x-xmpp-paid') === 'ok') {
      return next()
    }

    res.status(402).json({
      kind: 'mpp-session',
      service: 'stream-api',
      amountUsd: 0.005,
      asset: 'USDC_TESTNET',
      retryHeaderName: 'x-xmpp-paid',
      retryHeaderValue: 'ok',
      sessionId: 'stream-session-1',
    })
  })

  app.get('/stream/tick', (req: express.Request, res: express.Response) => {
    res.json({
      service: 'stream-api',
      route: req.header('x-xmpp-route'),
      tick: Date.now(),
      mode: 'mock-session',
    })
  })

  return app
}

function createLiveStreamApp(): express.Express {
  const app = express()
  const commitmentKey = Keypair.fromSecret(config.wallet.agentSecretKey ?? '')
  const payments = MppxChannel.create({
    secretKey: config.mpp.secretKey,
    methods: [
      mppChannel.channel({
        channel: config.mpp.channelContractId ?? '',
        commitmentKey,
        sourceAccount: commitmentKey.publicKey(),
        store: ChannelStore.memory(),
        network: stellarNetwork,
      }),
    ],
  })

  app.get('/stream/tick', async (req: express.Request, res: express.Response) => {
    const result = await payments.channel({
      amount: '0.005',
      description: 'Streaming tick',
    })(toWebRequest(req))

    if (result.status === 402) {
      return sendWebResponse(res, result.challenge)
    }

    return sendWebResponse(
      res,
      result.withReceipt(
        Response.json({
          service: 'stream-api',
          route: req.header('x-xmpp-route') ?? 'mpp-session-reuse',
          tick: Date.now(),
          mode: 'live-session',
        }),
      ),
    )
  })

  return app
}

export function createStreamApp(): express.Express {
  if (config.mpp.channelContractId && config.wallet.agentSecretKey && config.mpp.secretKey) {
    return createLiveStreamApp()
  }

  const app = createMockStreamApp()
  app.get('/stream/status', (_req: express.Request, res: express.Response) => {
    res.json({
      live: false,
      reason: 'MPP session route is waiting on a deployed one-way-channel contract.',
      required: ['MPP_CHANNEL_CONTRACT_ID'],
    })
  })

  return app
}

export function startDemoServices() {
  const research = createResearchApp()
  const market = createMarketApp()
  const stream = createStreamApp()

  research.listen(new URL(config.services.research).port, () => {
    console.log(`[xMPP] research-api listening on ${config.services.research}`)
  })

  market.listen(new URL(config.services.market).port, () => {
    console.log(`[xMPP] market-api listening on ${config.services.market}`)
  })

  stream.listen(new URL(config.services.stream).port, () => {
    console.log(`[xMPP] stream-api listening on ${config.services.stream}`)
  })
}

if (import.meta.url === `file://${process.argv[1]}`) {
  startDemoServices()
}
