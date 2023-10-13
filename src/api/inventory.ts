import { z } from 'zod'

export const InventorySchema = z.object({
  contract: z.string(),
  chainId: z.number(),
  amount: z.string()
})

export const InventoryEventSchema = z.object({
  type: z.literal('inventory'),
  meta: z.object({
    account: z.string(),
    finished: z.boolean()
  }),
  data: z.array(z.string())
})

export type Inventory = z.infer<typeof InventorySchema>
export type InventoryEvent = z.infer<typeof InventoryEventSchema>
