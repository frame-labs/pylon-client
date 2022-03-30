import { EventEmitter } from 'events'
import WebSocket from 'isomorphic-ws'
import { AssetId, parse, stringify } from './assetId'

import { Subscription, Settings, Rates, SubscriptionType } from './types'

export { AssetType } from './assetId'

function uniqueChainIds (uniqueIds: string[], assetId: AssetId) {
  const chainId = assetId.chainId.toString()

  if (!uniqueIds.includes(chainId)) {
    uniqueIds.push(chainId)
  }

  return uniqueIds
}

class Pylon extends EventEmitter {
  // private
  private ws?: WebSocket
  private pingTimeout?: NodeJS.Timeout
  private connectionTimer?: NodeJS.Timeout

  private readonly location: string
  private destroyed: boolean = false

  private readonly subscriptions: Subscription[] = []
  private readonly settings: Settings

  // public
  connected: boolean = false

  constructor (location: string = '', settings: Settings = {}) {
    super()
    this.location = location
    this.settings = { reconnect: true, ...settings }

    this.connect()
  }

  connect () {
    this.disconnect()
    this.ws = new WebSocket(this.location)
    this.ws.addEventListener('open', this.open.bind(this))
    // @ts-ignore
    this.ws.addEventListener('error', this.error.bind(this))
    this.ws.addEventListener('message', this.message.bind(this))
    // Fix heartbeat
    // this.ws.addEventListener('ping', this.heartbeat.bind(this))
    this.ws.addEventListener('close', this.close.bind(this))

    if (this.connectionTimer) clearTimeout(this.connectionTimer)
    if (this.settings.reconnect) this.connectionTimer = setInterval(() => this.connect(), 15 * 1000)
  }

  heartbeat () {
    if (this.pingTimeout) clearTimeout(this.pingTimeout)
    this.pingTimeout = setTimeout(() => this.ws?.close(), 30000 + 2000)
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

  message (message: any) {
    try {
      const [event, ...params] = JSON.parse(message.data.toString())
      

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
    this.ws?.close()
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

  rates (assetIds: string[]) {
    // subscribe to rates
    this.subscribe({
      type: SubscriptionType.Rates,
      data: assetIds
    })
  }

  chains (chainIds: string[]) {
    // subscribe to chains
    this.subscribe({
      type: SubscriptionType.Chains,
      data: chainIds
    })
  }

  assets (assetIds: AssetId[]) {
    // subscribe to rates
    this.subscribe({
      type: SubscriptionType.Rates,
      data: assetIds.map(stringify)
    })

    // subscribe to chains
    this.subscribe({
      type: SubscriptionType.Chains,
      data: assetIds.reduce(uniqueChainIds, [])
    })
  }

  inventories (accounts: string[]) {
    this.subscribe({
      type: SubscriptionType.Inventories,
      data: accounts
    })
  }

  private subscribe (subscription: Subscription) {
    this.sendPayload(subscription.type, subscription.data)

    // Check subscriptions to see if this type of subscription already exists
    const existingIndex = this.subscriptions.findIndex(sub => sub.type === subscription.type)
    if (existingIndex !== -1) {
      this.subscriptions[existingIndex] = subscription
    } else {
      this.subscriptions.push(subscription)
    }
  }
}

export default Pylon
