import pino from 'pino'

export const logger = pino({
  name: 'xmpp',
  level: process.env.LOG_LEVEL ?? 'info',
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.x-api-key',
      'req.headers.cookie',
      'req.body.headers.authorization',
      'req.body.headers.x-api-key',
      'req.body.options.idempotencyKey',
      'err.config.headers.authorization',
      'err.config.headers.x-api-key',
    ],
    censor: '[REDACTED]',
  },
})
