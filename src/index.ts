import { EventEmitter } from 'events'
import WebSocket from 'isomorphic-ws'

import { Subscription, Settings } from './types'

class Pylon extends EventEmitter {
  ws?: WebSocket
  pingTimeout?: NodeJS.Timeout
  connectionTimer?: NodeJS.Timeout
  subscriptions: Subscription[] = []
  settings: Settings = {
    reconnect: true
  }
  location: string

  constructor (location: string = '', settings: Settings = {}) {
    super()
    this.location = location
    Object.assign(this.settings, settings)
    this.connect()
  }

  connect () {
    this.ws = new WebSocket(this.location)
    this.ws.on('open', this.open.bind(this))
    this.ws.on('message', this.message.bind(this))
    this.ws.on('ping', this.heartbeat.bind(this))
    this.ws.on('close', this.close.bind(this))
    this.ws.on('error', this.error.bind(this))
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

    this.emit('connection')
  }

  message (data: any) {
    try {
      const [event, ...params] = JSON.parse(data.toString())
      this.emit(event, ...params)
    } catch (e) {
      console.error('Error parsing message', e)
    }
  }

  disconnect () {
    this.ws?.terminate()
  }

  close () {
    if (this.connectionTimer) clearTimeout(this.connectionTimer)
    if (this.pingTimeout) clearTimeout(this.pingTimeout)
    if (this.settings.reconnect) this.connectionTimer = setInterval(() => this.connect(), 5000)
    this.emit('close')
  }

  error (err: NodeJS.ErrnoException) {
    if (this.listenerCount('error') > 0) this.emit('error', err)
  }

  sendPayload (method: string, ...params: any[]) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ method: method, params: params }))
    } else {
      console.error('Pylon not connected')
    }
  }

  rates (assets: string[]) {
    const subscription = {
      type: 'rates', 
      data: assets
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
