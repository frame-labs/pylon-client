export interface Subscription {
  type: 'rates' | 'inventories' | 'chains',
  data: string[]
}

export interface Settings {
  reconnect?: Boolean
}

export interface Rates {
  id: string,
  data: any
}
