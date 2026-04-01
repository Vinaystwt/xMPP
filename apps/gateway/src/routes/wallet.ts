import type { Express, Request, Response } from 'express'
import { getWalletInfo } from '@xmpp/wallet'

export function registerWalletRoute(app: Express) {
  app.get('/wallet', async (_req: Request, res: Response) => {
    const wallet = await getWalletInfo()
    res.json(wallet)
  })
}
