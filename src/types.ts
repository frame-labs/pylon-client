import { EventEmitter } from 'events'

import type { Event } from 'ws'
import { PylonEvent } from './api/events'

export type SocketEvent = 'open' | 'close' | 'message' | 'error'

export enum SubscriptionType {
  Activity = 'activity',
  Rates = 'rates',
  Chains = 'chains'
}

export interface Rates {
  id: string
  data: any
}

export interface Listener {
  method: SocketEvent
  handler: (event: Event) => void
}

export type EventTypes = {
  open: []
  error: [Error]
  close: []
  data: [PylonEvent]
}

export class TypedEventEmitter<TEvents extends Record<string, any>> {
  private emitter = new EventEmitter()

  listenerCount(eventName: string | symbol) {
    return this.emitter.listenerCount(eventName)
  }

  removeAllListeners() {
    return this.emitter.removeAllListeners()
  }

  emit<TEventName extends keyof TEvents & string>(
    eventName: TEventName,
    ...eventArg: TEvents[TEventName]
  ) {
    this.emitter.emit(eventName, ...(eventArg as []))
  }

  on<TEventName extends keyof TEvents & string>(
    eventName: TEventName,
    handler: (...eventArg: TEvents[TEventName]) => void
  ) {
    this.emitter.on(eventName, handler as any)
  }

  off<TEventName extends keyof TEvents & string>(
    eventName: TEventName,
    handler: (...eventArg: TEvents[TEventName]) => void
  ) {
    this.emitter.off(eventName, handler as any)
  }
}
