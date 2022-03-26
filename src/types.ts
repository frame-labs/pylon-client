export interface Subscription {
  type: string,
  data: string[]
}

export interface Settings {
  reconnect?: Boolean
}

export interface Rates {
  id: string,
  data: any
}
