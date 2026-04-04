import type { NextFunction, Request, Response } from 'express'
import { logger } from '@xmpp/logger'

export function gatewayErrorHandler(
  error: unknown,
  req: Request,
  res: Response,
  next: NextFunction,
) {
  void next

  logger.error(
    {
      error,
      method: req.method,
      url: req.originalUrl,
    },
    '[xMPP] gateway error',
  )

  if (res.headersSent) {
    return
  }

  const statusCode =
    typeof error === 'object' &&
    error !== null &&
    'status' in error &&
    typeof (error as { status?: unknown }).status === 'number'
      ? ((error as { status: number }).status ?? 500)
      : 500

  const message =
    error instanceof Error ? error.message : 'Unexpected gateway error'

  res.status(statusCode).json({
    error: message,
  })
}
