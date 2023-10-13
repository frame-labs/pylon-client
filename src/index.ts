import log from '@framelabs/logger'
import TypedEmitter from 'typed-emitter'
import { EventEmitter } from 'events'

import Connection from './connection/index.js'
import { stringify as stringifyAssetId } from './assetId.js'
import { PylonEventSchema } from './api/events.js'
import { SubscriptionType } from './types.js'

import type { ConnectionOpts } from './connection/index.js'
import type { PylonEvent } from './api/events.js'
import type { AssetId } from './assetId.js'

export { AssetType } from './assetId.js'
export type PylonClient = ReturnType<typeof createPylon>

type MessageEvents = {
  connect: () => void
  close: () => void
  data: (body: PylonEvent) => void
}

function createPylon(url: string, opts?: Partial<ConnectionOpts>) {
  let connected = false

  const connection = Connection(url, opts)

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

  function updateSubscriptions(type: SubscriptionType, ids: string[]) {
    const existingSubscriptions = subscriptions.get(type) ?? []
    const existingIds = new Set(existingSubscriptions)

    const { toSubscribe, toUnsubscribe } = ids.reduce(
      (acc, id) => {
        if (!existingIds.has(id)) {
          acc.toSubscribe.add(id)
        } else {
          acc.toUnsubscribe.delete(id)
        }

        return acc
      },
      { toSubscribe: new Set<string>(), toUnsubscribe: new Set(existingIds) }
    )

    // subscribe to all new ids
    if (toSubscribe.size > 0) {
      subscribe(type, [...toSubscribe])
    }

    // unsubscribe from all ids that are no longer in the list
    if (toUnsubscribe.size > 0) {
      unsubscribe(type, [...toUnsubscribe])
    }

    subscriptions.set(type, ids)
  }

  function subscribe(type: SubscriptionType, ids: string[]) {
    log.debug(`Subscribing to ${type}`, { ids })
    connection.send(`subscribe${type}`, ids)
  }

  function unsubscribe(type: SubscriptionType, ids: string[]) {
    log.debug(`Unsubscribing from ${type}`, { ids })
    connection.send(`unsubscribe${type}`, ids)
  }

  // public API
  const on = events.on.bind(events)
  const once = events.once.bind(events)
  const off = events.off.bind(events)
  const { connect, close } = connection

  function activity(accounts: string[]) {
    updateSubscriptions(SubscriptionType.Activity, accounts)
  }

  function tokens(ids: AssetId[]) {
    updateSubscriptions(SubscriptionType.Tokens, ids.map(stringifyAssetId))
  }

  // TODO: will define this object shape later
  async function simulate(tx: any) {
    const result = await connection.request('simulateTransaction', tx)

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
    tokens,
    simulate
  }
}

export default createPylon
