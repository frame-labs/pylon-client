export enum SubscriptionType {
  Activity = 'activity',
  Tokens = 'tokens',
  Rates = 'rates',
  Chains = 'chains'
}

export interface Rates {
  id: string
  data: any
}
