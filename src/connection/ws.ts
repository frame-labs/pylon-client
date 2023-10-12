import { EventEmitter } from 'events'
import WebSocket, { ErrorEvent, MessageEvent } from 'isomorphic-ws'

import log from '@framelabs/logger'

type ClientMessageType = 'pong' | 'request'

function createSocketConnection(url: string) {
  log.info(`Connecting to ${url}`)

  const ws = new WebSocket(url)
  const events = new EventEmitter()

  let pingTimeout: NodeJS.Timeout

  function send(type: ClientMessageType, data?: any) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify([type, data]))
    } else {
      log.error(`Pylon not connected when sending ${type}`)
    }
  }

  function heartbeat() {
    if (pingTimeout) clearTimeout(pingTimeout)

    pingTimeout = setTimeout(() => {
      log.warn('Timed out waiting for ping from server, closing connection')
      ws.close()
    }, 30_000)

    send('pong')
  }

  function onOpen() {
    log.debug(`Socket connection to ${url} opened`)

    heartbeat()
    events.emit('open')
  }

  function onClose() {
    log.debug(`Socket connection to ${url} closed`)

    ws.onopen = null
    ws.onclose = null
    ws.onmessage = null
    ws.onerror = null

    if (pingTimeout) clearTimeout(pingTimeout)

    events.emit('close')
    events.removeAllListeners()
  }

  function onMessage({ data }: MessageEvent) {
    try {
      const [event, payload] = JSON.parse(data.toString())

      if (event === 'ping') {
        log.debug('Received ping from server')
        heartbeat()
      } else {
        log.debug('Recieved message from server', { event, payload })
        events.emit('data', event, payload)
      }
    } catch (e) {
      log.error('Error parsing socket message', e)
    }
  }

  function onError(e: ErrorEvent) {
    log.warn('Received socket error', e)
  }

  ws.onopen = onOpen
  ws.onclose = onClose
  ws.onmessage = onMessage
  ws.onerror = onError

  return {
    close: () => ws.close(),
    on: events.on.bind(events),
    off: events.off.bind(events),
    send
  }
}

export default createSocketConnection
