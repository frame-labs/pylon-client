import { z } from 'zod'

import { BalanceEventSchema } from './balances.js'
import { InventoryEventSchema } from './inventory.js'

export const PylonEventSchema = z.union([
  BalanceEventSchema,
  InventoryEventSchema
])

export type PylonEvent = z.infer<typeof PylonEventSchema>
