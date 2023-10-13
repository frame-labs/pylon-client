import { z } from 'zod'

export const BalanceSchema = z.object({
  contract: z.string(),
  chainId: z.number(),
  amount: z.string()
})

export const BalanceEventSchema = z.object({
  type: z.literal('balances'),
  meta: z.object({
    account: z.string(),
    finished: z.boolean()
  }),
  data: z.array(BalanceSchema)
})

export type Balance = z.infer<typeof BalanceSchema>
export type BalanceEvent = z.infer<typeof BalanceEventSchema>
