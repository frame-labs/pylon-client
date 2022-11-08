// @ts-nocheck
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
let id = 1

function log (d, ...args) {
  console.log(`[ ${new Date().toISOString()} ] ${d}`, ...args)
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

  close () {
    this.destroyed = true
    this.clearTimers()
    if (this.ws && WebSocket && this.ws.readyState !== WebSocket.CLOSED) {
      this.removeAllSocketListeners()
      this.addSocketListener('error', () => {})
      this.addSocketListener('close', this.onClose.bind(this))

      this.disconnect()
    } else {
      this.onClose()
    }
  }

  private connect () {
    log('trying to connect ... ')
    try {
      const ws = new WebSocket(this.location)
      // @ts-ignore
      ws.id = id++

      this.ws = ws

      // @ts-ignore
      log('created ws object', { id: ws.id })
      this.addSocketListener('open', e => {
        log('OPEN EVENT', { id: ws.id })
        this.onOpen(e)
      })

      this.addSocketListener('error', e => {
        log('ERROR EVENT', { id: ws.id })
        this.onError(e, ws.id)
      })

      this.addSocketListener('message', e => {
        //console.log('MESSAGE EVENT', e, { id: ws.id })
        this.onMessage(e)
      })

      this.addSocketListener('close', e => {
        log('CLOSE EVENT', { id: ws.id })
        this.onClose(e)
      })
    } catch (e) {
      log('error constructing ws object', e)
    }
  }

  private async disconnect () {
    if (this.ws?.terminate) {
      log('TERMINATE')
      this.ws?.terminate()
    } else {
      log('NOT TERMINATE')
      this.ws?.close()
    }
  }

  private clearTimers () {
    if (this.pingTimeout) clearTimeout(this.pingTimeout)
    if (this.connectionTimer) clearTimeout(this.connectionTimer)
  }

  private onOpen () {
    log('OPEN!')
    if (this.connectionTimer) clearTimeout(this.connectionTimer)
    this.heartbeat()

    this.subscriptions.forEach(subscription => {
      this.send(subscription.type, subscription.data)
    })

    this.connected = true
    this.emit('open')
  }

  private onClose () {
    // onClose should only be called as a result of the socket's close event
    // OR when close() is called manually and the socket either doesn't exist or is already in a closed state
    this.clearTimers()
    if (this.ws) {
      this.removeAllSocketListeners()
      this.ws = undefined
    }
    this.connected = false
    this.emit('close')
    if (this.destroyed) {
      this.removeAllListeners()
    } else {
      if (this.settings.reconnect) this.connectionTimer = setTimeout(() => { log('onClose connection timer fired!'); this.connect() }, 5000)
    }
  }

  private onMessage (message: any) {
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

  private onError (err: any, id: number) {
    log('onError!', err.message, { id })
    if (err.message === 'WebSocket was closed before the connection was established') return
    if (this.listenerCount('error') > 0) {
      log('**** EMITTING ERROR')
      this.emit('error', err)
    }
  }

  private addSocketListener (method: any, handler: any) {
    log('addSocketListener', { method, id: this.ws.id })
    this.ws?.addEventListener(method, handler)
    this.socketListeners.push({ method, handler })
  }

  private removeAllSocketListeners () {
    this.socketListeners.forEach(({ method, handler }) => {
      log('REMOVE LISTENER --> ', { method, id: this.ws.id })
      this.ws?.removeEventListener(method, handler)
    })
    this.socketListeners = []
  }

  private heartbeat () {
    this.send('pong')
    if (this.pingTimeout) clearTimeout(this.pingTimeout)
    this.pingTimeout = setTimeout(() => {
      log('PING TIMEOUT!')
      this.ws?.close()
    }, 30000 + 2000)
  }

  private send (method: string, ...params: any[]) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ method: method, params: params }))
    } else {
      //this.onError(new Error(`Pylon not connected when sending ${method}`))
    }
  }

  // subscription methods
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
