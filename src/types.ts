import type { Event } from 'ws'

export type SocketEvent = 'open' | 'close' | 'message' | 'error'

export enum SubscriptionType {
  Rates = 'rates',
  Inventories = 'inventories',
  Chains = 'chains'
}

export interface Subscription {
  type: SubscriptionType
  data: string[]
}

export interface Settings {
  reconnect?: Boolean
}

export interface Rates {
  id: string
  data: any
}

export interface Listener {
  method: SocketEvent
  handler: (event: Event) => void
}
