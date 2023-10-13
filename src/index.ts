import log from '@framelabs/logger'
import TypedEmitter from 'typed-emitter'
import { EventEmitter } from 'events'

import createConnection from './connection/index.js'
import { PylonEventSchema } from './api/events.js'
import { SubscriptionType } from './types.js'

import type { ConnectionOpts } from './connection/index.js'
import type { PylonEvent } from './api/events.js'

type MessageEvents = {
  connect: () => void
  close: () => void
  data: (body: PylonEvent) => void
}

export type PylonClient = ReturnType<typeof createPylon>

function createPylon(url: string, opts?: Partial<ConnectionOpts>) {
  let connected = false

  const connection = createConnection(url, opts)

  const events = new EventEmitter() as TypedEmitter<MessageEvents>
  const subscriptions: Map<SubscriptionType, string[]> = new Map()

  connection.on('connect', () => {
    log.info(`Pylon connected at ${url}`)

    connected = true
    events.emit('connect')
  })

  connection.on('close', () => {
    log.info(`Pylon disconnected at ${url}`)

    connected = false
    events.emit('close')
  })

  connection.on('data', (event: unknown) => {
    const parseResult = PylonEventSchema.safeParse(event)

    if (parseResult.success) {
      events.emit('data', parseResult.data)
    } else {
      log.warn('Failed to parse incoming event', parseResult.error.issues)
    }
  })

  function subscribe(type: SubscriptionType, ids: string[]) {
    connection.send({ method: type, params: ids })

    subscriptions.set(type, ids)
  }

  // public API
  const on = events.on.bind(events)
  const once = events.once.bind(events)
  const off = events.off.bind(events)
  const { connect, close } = connection

  function activity(accounts: string[]) {
    subscribe(SubscriptionType.Activity, accounts)
  }

  // TODO: will define this object shape later
  async function simulate(tx: any) {
    const result = await connection.request('simulate', tx)

    // TODO: use zod to verify object shape here and send response
    // could we possibly pass the schema to request and do it there in a re-usable way?

    return result
  }

  return {
    isConnected: () => connected,
    on,
    once,
    off,
    connect,
    close,
    activity,
    simulate
  }
}

export default createPylon
