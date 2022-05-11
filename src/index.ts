import { EventEmitter } from 'events'
import WebSocket from 'isomorphic-ws'
import { AssetId, parse, stringify } from './assetId'

import { Subscription, Settings, Rates, SubscriptionType, Listener } from './types'

export { AssetType } from './assetId'

function dedupChainIds (uniqueIds: string[], chainId: number) {
  const id = chainId.toString()

  if (!uniqueIds.includes(id)) {
    uniqueIds.push(id)
  }

  return uniqueIds
}

class Pylon extends EventEmitter {
  // private
  private ws?: WebSocket
  private pingTimeout?: NodeJS.Timeout
  private connectionTimer?: NodeJS.Timer

  private readonly location: string
  private destroyed: boolean = false
  private socketListeners: Listener[] = []

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
    this.addSocketListener('open', this.onOpen.bind(this))
    this.addSocketListener('error', this.onError.bind(this))
    this.addSocketListener('message', this.onMessage.bind(this))
    this.addSocketListener('close', this.onClose.bind(this))

    if (this.connectionTimer) clearInterval(this.connectionTimer)
    if (this.settings.reconnect) this.connectionTimer = setInterval(() => this.connect(), 15 * 1000)
  }

  onOpen () {
    if (this.connectionTimer) clearInterval(this.connectionTimer)
    this.heartbeat()

    this.subscriptions.forEach(subscription => {
      this.send(subscription.type, subscription.data)
    })

    this.connected = true
    this.emit('open')
  }

  onClose () {
    // onClose should only be called as a result of the socket's close event
    // OR when close() is called manually and the socket either doesn't exist or is already in a closed state
    if (this.pingTimeout) clearTimeout(this.pingTimeout)
    if (this.connectionTimer) clearInterval(this.connectionTimer)
    if (this.settings.reconnect && !this.destroyed) this.connectionTimer = setInterval(() => this.connect(), 5000)

    if (this.ws) {
      this.removeAllSocketListeners()
      this.ws = undefined
    }

    this.connected = false

    this.emit('close')
    this.removeAllListeners()
  }

  onError (err: any) {
    if (err.message === 'WebSocket was closed before the connection was established') return
    if (this.listenerCount('error') > 0) this.emit('error', err)
  }

  onMessage (message: any) {
    try {
      const [event, ...params] = JSON.parse(message.data.toString())
      
      if (event === 'ping') {
        this.heartbeat()
      } else if (event === 'rates') {
        const rates = params[0] as Rates[]
        this.emit('rates', rates.map(({ id, data }) => ({ id: parse(id), data })))
      } else {
        this.emit(event, ...params)
      }
    } catch (e) {
      console.error('Error parsing message', e)
    }
  }

  addSocketListener (method: any, handler: any) {
    this.ws?.addEventListener(method, handler)
    this.socketListeners.push({ method, handler })  
  }

  removeAllSocketListeners () {
    this.socketListeners.forEach(({ method, handler }) => {
      this.ws?.removeEventListener(method, handler)
    })
    this.socketListeners = []
  }

  heartbeat () {
    this.send('pong')
    if (this.pingTimeout) clearTimeout(this.pingTimeout)
    this.pingTimeout = setTimeout(() => this.ws?.close(), 30000 + 2000)
  }

  disconnect () {
    this.ws?.close()
  }

  close () {
    if (this.ws && WebSocket && this.ws.readyState !== WebSocket.CLOSED) {
      this.removeAllSocketListeners()
      this.addSocketListener('error', () => {})
      this.addSocketListener('close', this.onClose.bind(this))
      if (this.ws.terminate) {
        this.ws.terminate()
      } else {
        this.ws.close()
      }
    } else {
      this.onClose()
    }
  }

  destroy () {
    this.destroyed = true
    this.disconnect()
    this.removeAllListeners()
  }

  error (err: any) {
    if (err.message === 'WebSocket was closed before the connection was established') return
    if (this.listenerCount('error') > 0) this.emit('error', err)
  }

  send (method: string, ...params: any[]) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ method: method, params: params }))
    } else {
      this.error(new Error(`Pylon not connected when sending ${method}`))
    }
  }

  rates (assetIds: AssetId[]) {
    this.subscribe({
      type: SubscriptionType.Rates,
      data: assetIds.map(stringify)
    })
  }

  chains (chainIds: number[]) {
    this.subscribe({
      type: SubscriptionType.Chains,
      data: chainIds.reduce(dedupChainIds, [])
    })
  }

  inventories (accounts: string[]) {
    this.subscribe({
      type: SubscriptionType.Inventories,
      data: accounts
    })
  }

  private subscribe (subscription: Subscription) {
    this.send(subscription.type, subscription.data)

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
