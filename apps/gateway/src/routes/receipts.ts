import type { Express, Request, Response } from 'express'
import type { XmppSignedReceipt } from '@xmpp/types'
import { verifyXmppReceipt } from '@xmpp/wallet'

export function registerReceiptRoutes(app: Express) {
  app.post('/receipts/verify', (req: Request, res: Response) => {
    const receipt = req.body as XmppSignedReceipt | undefined
    if (!receipt?.receiptId || !receipt?.signature || !receipt?.agent) {
      return res.status(400).json({
        error: 'A full signed receipt payload is required.',
      })
    }

    const result = verifyXmppReceipt(receipt)
    res.json(result)
  })
}
