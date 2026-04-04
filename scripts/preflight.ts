import type { Server } from 'node:http'
import { setTimeout as delay } from 'node:timers/promises'
import { createResearchApp } from '../apps/demo-services/src/index.js'
import { createFacilitatorApp } from '../apps/facilitator/src/index.js'
import { config } from '../packages/config/src/index.js'
import { executePaymentRoute } from '../packages/payment-adapters/src/index.js'
import { getWalletInfo } from '../packages/wallet/src/index.js'

function extractProbeTxHash(result: Awaited<ReturnType<typeof executePaymentRoute>>) {
  const direct = result.metadata.signedReceipt?.txHash
  if (direct) {
    return direct
  }

  const paymentResponse = result.metadata.evidenceHeaders?.['payment-response']
  if (!paymentResponse) {
    return null
  }

  try {
    const decoded = JSON.parse(Buffer.from(paymentResponse, 'base64').toString('utf8')) as {
      transaction?: string
    }
    return decoded.transaction ?? null
  } catch {
    return null
  }
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

async function main() {
  const wallet = await getWalletInfo()
  const servers: Server[] = []

  try {
    servers.push(await listen(createFacilitatorApp(), Number(new URL(config.x402.facilitatorUrl).port)))
    servers.push(await listen(createResearchApp(), Number(new URL(config.services.research).port)))
    await delay(250)

    const probe = await executePaymentRoute('x402', `${config.services.research}/research?q=stellar`, {
      method: 'GET',
    })
    const probeBody = await probe.response.text()
    const probeTxHash = extractProbeTxHash(probe)
    const success =
      wallet.smartAccount.demoReady &&
      probe.response.status === 200 &&
      probe.metadata.settlementStrategy === 'smart-account' &&
      Boolean(probeTxHash)

    console.log(
      JSON.stringify(
        {
          ok: success,
          summary: success
            ? 'Smart-account x402 path is ready.'
            : 'Smart-account x402 path is not fully ready.',
          wallet: {
            settlementStrategy: wallet.settlementStrategy,
            smartAccount: wallet.smartAccount,
            feeSponsorship: wallet.feeSponsorship,
          },
          probe: {
            status: probe.response.status,
            settlementStrategy: probe.metadata.settlementStrategy,
            smartAccount: probe.metadata.smartAccount,
            txHash: probeTxHash,
            signedReceipt: probe.metadata.signedReceipt,
            body: probeBody,
          },
        },
        null,
        2,
      ),
    )

    if (!success) {
      process.exitCode = 1
    }
  } finally {
    await Promise.allSettled(servers.map(closeServer))
  }
}

main().catch((error) => {
  console.error('[xMPP preflight] failed', error)
  process.exit(1)
})
