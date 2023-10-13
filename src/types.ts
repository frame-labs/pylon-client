export enum SubscriptionType {
  Activity = 'Activity',
  Tokens = 'Tokens',
  Rates = 'Rates',
  Chains = 'Chains'
}

export interface Rates {
  id: string
  data: any
}
