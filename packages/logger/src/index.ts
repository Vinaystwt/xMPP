import pino from 'pino'

export const logger = pino({
  name: 'xmpp',
  level: process.env.LOG_LEVEL ?? 'info',
})
