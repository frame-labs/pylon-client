import { z } from 'zod'

import { BalanceEventSchema } from './balances.js'
import { InventoryEventSchema } from './inventory.js'
import { TokenEventSchema } from './tokens.js'

export const PylonEventSchema = z.union([
  BalanceEventSchema,
  InventoryEventSchema,
  TokenEventSchema
])

export type PylonEvent = z.infer<typeof PylonEventSchema>
