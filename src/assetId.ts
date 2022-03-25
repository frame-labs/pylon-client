export enum AssetType {
  NativeCurrency, Token
}

export interface AssetId {
  chainId: number,
  address?: string,
  type: AssetType
}

export type CaipId = string

export function stringify (id: AssetId): CaipId {
  if (id.type === AssetType.NativeCurrency) {
    return [`eip155:${id.chainId}`, `slip44:60`].join('/')
  }

  if (id.type === AssetType.Token) {
    return [`eip155:${id.chainId}`, `erc20:${id.address}`].join('/')
  }

  throw new Error(`could not stringify asset id with invalid type: ${id.type}`)
}
