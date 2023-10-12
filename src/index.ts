import { EventEmitter } from 'events'

import createConnection from './connection/index.js'

import { SubscriptionType } from './types.js'

import type { ConnectionOpts } from './connection/index.js'
export { AssetType } from './assetId'

function createPylon(url: string, opts: ConnectionOpts) {
  let connected = false

  const connection = createConnection(url, opts)

  const events = new EventEmitter()
  const subscriptions: Map<SubscriptionType, string[]> = new Map()

  connection.on('connect', () => {
    connected = true
    events.emit('connect')
  })

  connection.on('close', () => {
    connected = false
    events.emit('close')
  })

  connection.on('data', (event) => {
    // TODO: use zod to parse event and emit typed events
    events.emit('data', event)
  })

  function subscribe(type: SubscriptionType, ids: string[]) {
    connection.send({ method: type, params: ids })

    subscriptions.set(type, ids)
  }

  // public API
  const on = events.on.bind(events)
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
    on,
    connect,
    close,
    activity,
    simulate
  }
}

export default createPylon
