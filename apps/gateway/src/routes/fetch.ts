import type { Express, NextFunction, Request, Response } from 'express'
import { createRouter } from '@xmpp/router'
import { getXmppMetadata, xmppFetch } from '@xmpp/http-interceptor'

const router = createRouter()

export function registerFetchRoute(app: Express) {
  app.post('/fetch', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { url, method = 'GET', headers, body, options } = req.body
      const routePreview = await router.preview({
        url,
        method,
        serviceId: options?.serviceId,
        projectedRequests: options?.projectedRequests,
        streaming: options?.streaming,
      })

      const response = await xmppFetch(
        url,
        {
          method,
          headers,
          body: typeof body === 'string' ? body : body ? JSON.stringify(body) : undefined,
        },
        options,
      )

      const text = await response.text()
      const metadata = getXmppMetadata(response)
      const responseHeaders: Record<string, string> = {}
      response.headers.forEach((value, key) => {
        responseHeaders[key] = value
      })
      res.json({
        status: response.status,
        routePreview,
        payment: metadata,
        responseHeaders,
        body: text,
      })
    } catch (error) {
      next(error)
    }
  })
}
