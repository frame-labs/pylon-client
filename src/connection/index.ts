import log from '@framelabs/logger'
import { EventEmitter } from 'events'
import { z } from 'zod'

import createSocket from './ws.js'

export type ConnectionOpts = {
  reconnectTimeout: number
}

type ServerMessageType = 'response' | 'event'

type PendingRequest = {
  resolve: (data: unknown) => void
  reject: (reason: any) => void
}

const SuccessfulResponseSchema = z.object({
  id: z.number(),
  result: z.unknown()
})

const ErrorResponseSchema = z.object({
  id: z.number(),
  error: z.any()
})

const ResponseSchema = z.union([SuccessfulResponseSchema, ErrorResponseSchema])

type RPCRequest = {
  id: string
  method: string
  params: unknown[]
}

function createConnection(
  url: string,
  { reconnectTimeout }: Partial<ConnectionOpts> = {}
) {
  let nextId = 1
  let reconnectTimer: NodeJS.Timeout
  let ws: ReturnType<typeof createSocket>

  const requests = new Map<number, PendingRequest>()
  const clearReconnect = () => clearTimeout(reconnectTimer)

  const events = new EventEmitter()

  function closeHandler() {
    events.emit('close')

    clearReconnect()

    if (reconnectTimeout) {
      log.debug(
        `Connection closed, will re-attempt connection in ${reconnectTimeout}ms`
      )

      reconnectTimer = setTimeout(connect, reconnectTimeout)
    }
  }

  function messageHandler(type: ServerMessageType, payload: any) {
    if (type === 'event') {
      events.emit('data', payload)
    } else if (type === 'response') {
      const parseResult = ResponseSchema.safeParse(payload)

      if (parseResult.success) {
        const { id } = parseResult.data
        const request = requests.get(id)

        if (request) {
          if ('error' in parseResult.data) {
            request.reject(parseResult.data.error)
          } else if ('result' in parseResult.data) {
            request.resolve(parseResult.data.result)
          }

          requests.delete(id)
        }
      } else {
        log.error('Error parsing response', parseResult.error.issues)
      }
    } else {
      log.error('Received unknown message type from server', { type })
    }
  }

  function connect() {
    ws = createSocket(url)

    ws.on('open', () => events.emit('connect'))
    ws.on('close', closeHandler)
    ws.on('data', messageHandler)
  }

  function close() {
    log.debug(`Disconnecting from ${url}`)

    clearReconnect()

    events.removeAllListeners()

    ws.off('close', closeHandler)
    ws.close()
  }

  // waits for a response
  async function request(method: string, params: any) {
    if (ws) {
      return new Promise((respond, reject) => {
        const requestTimeout = setTimeout(() => {
          reject(new Error('Request timed out'))
        }, 30_000)

        const resolve = (data: unknown) => {
          clearTimeout(requestTimeout)
          respond(data)
        }

        const id = nextId++

        requests.set(id, { resolve, reject })

        ws.send('request', { id, method, params })
      })
    } else {
      log.error('Pylon not connected when sending RPC request', {
        method,
        params
      })
      throw new Error('Not connected')
    }
  }

  // sends a message without waiting for response
  function send(data: Omit<RPCRequest, 'id'>) {
    if (ws) {
      ws.send('request', { id: 0, ...data })
    } else {
      log.error('Pylon not connected when sending message', data)
    }
  }

  const on = events.on.bind(events)

  return { on, close, connect, send, request }
}

export default createConnection
