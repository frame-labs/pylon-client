import winston from 'winston'
import { format } from 'logform'

function getLogLevel () {
  if (process.env.LOG_LEVEL) return process.env.LOG_LEVEL

  switch (process.env.NODE_ENV) {
    case 'test':
      return 'emerg'
    case 'development':
      return 'debug'
    default:
      return 'info'
  }
}

const logger = winston.createLogger({
  level: getLogLevel(),
  format: format.combine(
    format.timestamp(),
    format.printf(info => {
      const { timestamp, level, message, ...meta } = info
      const metaInfo = Object.keys(meta || {}).length === 0 ? '' : JSON.stringify(meta)
      return `${timestamp} | [${level}] ${message} ${metaInfo}`
    })
  ),
  transports: [
    new winston.transports.Console()
  ]
})

export default logger
