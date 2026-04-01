import type { Server } from 'node:http'
import { setTimeout as delay } from 'node:timers/promises'
import { createGatewayApp } from '../apps/gateway/src/app.js'
import {
  createMarketApp,
  createResearchApp,
  createStreamApp,
} from '../apps/demo-services/src/index.js'
import { createFacilitatorApp } from '../apps/facilitator/src/index.js'
import { config } from '../packages/config/src/index.js'

async function main() {
  const servers: Server[] = []

  try {
    servers.push(await listen(createFacilitatorApp(), portOf(config.x402.facilitatorUrl)))
    servers.push(await listen(createResearchApp(), portOf(config.services.research)))
    servers.push(await listen(createMarketApp(), portOf(config.services.market)))
    servers.push(await listen(createStreamApp(), portOf(config.services.stream)))
    servers.push(await listen(createGatewayApp(), config.gatewayPort))

    await delay(250)

    const health = await getJson(`http://localhost:${config.gatewayPort}/health`)
    const wallet = await getJson(`http://localhost:${config.gatewayPort}/wallet`)
    const x402 = await gatewayFetch({
      url: `${config.services.research}/research?q=stellar`,
      method: 'GET',
      options: { serviceId: 'research-api', projectedRequests: 1 },
    })
    const charge = await gatewayFetch({
      url: `${config.services.market}/quote?symbol=XLM`,
      method: 'GET',
      options: { serviceId: 'market-api', projectedRequests: 1 },
    })
    const session = await gatewayFetch({
      url: `${config.services.stream}/stream/tick`,
      method: 'GET',
      options: { serviceId: 'stream-api', projectedRequests: 5, streaming: true },
    })
    const denied = await gatewayFetch({
      url: 'http://localhost:4102/admin/export',
      method: 'GET',
      options: { serviceId: 'market-api', projectedRequests: 1 },
    })

    console.log(
      JSON.stringify(
        {
          health,
          wallet,
          flows: {
            x402,
            charge,
            session,
            denied,
          },
        },
        null,
        2,
      ),
    )
  } finally {
    await Promise.allSettled(servers.map(closeServer))
  }
}

async function gatewayFetch(payload: unknown) {
  const response = await fetch(`http://localhost:${config.gatewayPort}/fetch`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  })

  return response.json()
}

async function getJson(url: string) {
  const response = await fetch(url)
  return response.json()
}

function listen(app: { listen: Server['listen'] }, port: number) {
  return new Promise<Server>((resolve, reject) => {
    const server = app.listen(port, () => resolve(server))
    server.on('error', reject)
  })
}

function closeServer(server: Server) {
  return new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error)
        return
      }

      resolve()
    })
  })
}

function portOf(url: string) {
  return Number(new URL(url).port)
}

main().catch((error) => {
  console.error('[xMPP] live smoke failed', error)
  process.exit(1)
})
