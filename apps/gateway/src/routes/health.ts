import { config } from '@xmpp/config'
import { getEffectiveSmartAccountFeeCeiling, getRouteExecutionPlan, getWalletInfo } from '@xmpp/wallet'
import type { Express, Request, Response } from 'express'

export function registerHealthRoute(app: Express) {
  app.get('/health', async (_req: Request, res: Response) => {
    const x402Plan = getRouteExecutionPlan('x402')
    const wallet = await getWalletInfo()
    res.json({
      ok: true,
      service: 'xmpp-gateway',
      network: config.network,
      paymentExecutionMode: config.paymentExecutionMode,
      services: config.services,
      smartAccount: {
        configured: Boolean(config.wallet.smartAccountContractId),
        routeCoverage: wallet.smartAccount.routeCoverage,
        x402Preferred: x402Plan.smartAccount.used,
        mppFallback: Boolean(config.wallet.smartAccountContractId),
        demoReady: x402Plan.smartAccount.used,
        guardedFallback: Boolean(config.wallet.smartAccountContractId),
        unsupportedRoutes: wallet.smartAccount.unsupportedRoutes,
        unsupportedReason: wallet.smartAccount.unsupportedReason,
        configuredMaxTransactionFeeStroops: config.x402.maxTransactionFeeStroops,
        effectiveMaxTransactionFeeStroops: getEffectiveSmartAccountFeeCeiling(),
        feeFloorApplied: wallet.smartAccount.feeFloorApplied,
        preflightFailures: wallet.smartAccount.preflightFailures,
      },
    })
  })
}
