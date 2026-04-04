import type { Server } from 'node:http'
import { createResearchApp } from '../apps/demo-services/src/index.js'
import { createFacilitatorApp } from '../apps/facilitator/src/index.js'
import { config } from '../packages/config/src/index.js'
import { executePaymentRoute } from '../packages/payment-adapters/src/index.js'
import { getWalletInfo } from '../packages/wallet/src/index.js'

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

async function main() {
  const servers: Server[] = []

  try {
    servers.push(await listen(createFacilitatorApp(), Number(new URL(config.x402.facilitatorUrl).port)))
    servers.push(await listen(createResearchApp(), Number(new URL(config.services.research).port)))
    const wallet = await getWalletInfo()

    const result = await executePaymentRoute('x402', `${config.services.research}/research?q=stellar`, {
      method: 'GET',
    })

    console.log(
      JSON.stringify(
        {
          wallet: {
            settlementStrategy: wallet.settlementStrategy,
            smartAccount: wallet.smartAccount,
          },
          status: result.response.status,
          metadata: result.metadata,
          body: await result.response.text(),
        },
        null,
        2,
      ),
    )
  } finally {
    await Promise.allSettled(servers.map(closeServer))
  }
}

main().catch((error) => {
  console.error('[xMPP smart-account probe] failed', error)
  process.exit(1)
})
