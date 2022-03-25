import { EventEmitter } from 'events'
import { WebSocket } from 'isomorphic-ws'
import { AssetId, parse, stringify } from './assetId'

import { Subscription, Settings, Rates } from './types'

export { AssetType } from './assetId'

class Pylon extends EventEmitter {
  ws?: WebSocket
  pingTimeout?: NodeJS.Timeout
  connectionTimer?: NodeJS.Timeout
  subscriptions: Subscription[] = []
  settings: Settings = {
    reconnect: true
  }
  location: string
  connected: boolean = false
  destroyed: boolean = false

  constructor (location: string = '', settings: Settings = {}) {
    super()
    this.location = location
    Object.assign(this.settings, settings)
    this.connect()
  }

  connect () {
    this.disconnect()
    this.ws = new WebSocket(this.location)
    this.ws.on('open', this.open.bind(this))
    this.ws.on('message', this.message.bind(this))
    this.ws.on('ping', this.heartbeat.bind(this))
    this.ws.on('close', this.close.bind(this))
    this.ws.on('error', this.error.bind(this))
    if (this.connectionTimer) clearTimeout(this.connectionTimer)
    if (this.settings.reconnect) this.connectionTimer = setInterval(() => this.connect(), 15 * 1000)
  }

  heartbeat () {
    if (this.pingTimeout) clearTimeout(this.pingTimeout)
    this.pingTimeout = setTimeout(() => this.ws?.terminate(), 30000 + 2000)
  }

  open () {
    if (this.connectionTimer) clearTimeout(this.connectionTimer)
    this.heartbeat()

    this.subscriptions.forEach(subscription => {
      this.sendPayload(subscription.type, subscription.data)
    })

    this.connected = true
    this.emit('open')
  }

  message (data: any) {
    try {
      const [event, ...params] = JSON.parse(data.toString())

      if (event === 'rates') {
        const rates = params[0] as Rates[]
        this.emit('rates', rates.map(({ id, data }) => ({ id: parse(id), data })))
      } else {
        this.emit(event, ...params)
      }
    } catch (e) {
      console.error('Error parsing message', e)
    }
  }

  disconnect () {
    this.ws?.terminate()
  }

  close () {
    if (this.pingTimeout) clearTimeout(this.pingTimeout)
    if (this.connectionTimer) clearTimeout(this.connectionTimer)
    if (this.settings.reconnect && !this.destroyed) this.connectionTimer = setInterval(() => this.connect(), 5000)
    this.connected = false
    this.emit('close')
  }

  destroy () {
    this.destroyed = true
    this.disconnect()
    this.removeAllListeners()
  }

  error (err: NodeJS.ErrnoException) {
    if (err.message === 'WebSocket was closed before the connection was established') return
    if (this.listenerCount('error') > 0) this.emit('error', err)
  }

  sendPayload (method: string, ...params: any[]) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ method: method, params: params }))
    } else {
      this.error(new Error(`Pylon not connected when sending ${method}`))
    }
  }

  rates (assetIds: AssetId[]) {
    const subscription = {
      type: 'rates', 
      data: assetIds.map(stringify)
    }

    this.sendPayload(subscription.type, subscription.data)

    // Check subscriptions to see if this type of subscription already exists
    const existingIndex = this.subscriptions.map(sub => sub.type).indexOf('monitorRates')
    if (existingIndex !== -1) {
      this.subscriptions[existingIndex] = subscription
    } else {
      this.subscriptions.push(subscription)
    }    
  }

  inventories (accounts: string[]) {
    const subscription = {
      type: 'inventories',
      data: accounts
    }

    this.sendPayload(subscription.type, subscription.data)

    // Check subscriptions to see if this type of subscription exists yet
    const existingIndex = this.subscriptions.map(sub => sub.type).indexOf('inventories')
    if (existingIndex !== -1) {
      this.subscriptions[existingIndex] = subscription
    } else {
      this.subscriptions.push(subscription)
    }
  }
}

export default Pylon
