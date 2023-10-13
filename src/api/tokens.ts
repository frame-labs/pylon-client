import { z } from 'zod'

export const MediaSchema = z.object({
  source: z.string().default(''),
  format: z.enum(['video', 'image', 'unknown', '']).default('unknown'),
  cdn: z
    .object({
      main: z.string().optional(),
      thumb: z.string().optional(),
      frozen: z.string().optional()
    })
    .default({})
})

export const TokenSchema = z.object({
  contract: z.string(),
  chainId: z.number(),
  name: z.string().default(''),
  media: MediaSchema.default({}),
  symbol: z.string(),
  decimals: z.number(),
  hideByDefault: z.boolean().default(false)
})

export const TokenEventSchema = z.object({
  type: z.literal('tokens'),
  meta: z.object({}),
  data: z.array(TokenSchema)
})

export type Media = z.infer<typeof MediaSchema>
export type Token = z.infer<typeof TokenSchema>
export type TokenEvent = z.infer<typeof TokenEventSchema>
