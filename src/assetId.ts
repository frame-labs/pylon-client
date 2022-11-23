export enum AssetType {
  NativeCurrency,
  Token,
}

export interface AssetId {
  chainId: number;
  address?: string;
  type: AssetType;
}

export type CaipId = string;

export function stringify(id: AssetId): CaipId {
  if (id.type === AssetType.NativeCurrency) {
    return [`eip155:${id.chainId}`, `slip44:60`].join("/");
  }

  if (id.type === AssetType.Token) {
    return [`eip155:${id.chainId}`, `erc20:${id.address}`].join("/");
  }

  throw new Error(`could not stringify asset id with invalid type: ${id.type}`);
}

export function parse(id: CaipId): AssetId {
  const segments = Object.fromEntries(
    id.split("/").map((segment) => segment.split(":"))
  );
  const chainId = parseInt(segments.eip155);

  if (!chainId) {
    throw new Error(
      `attempted to parse asset id with invalid eip-155 chain id: ${id}`
    );
  }

  if ("slip44" in segments) {
    // this is the SLIP44 native currency identifier
    if (segments.slip44 !== "60") {
      throw new Error(
        `attempted to parse non-Ethereum native currency asset id with id: ${id}`
      );
    }

    return {
      type: AssetType.NativeCurrency,
      chainId,
    };
  }

  if ("erc20" in segments) {
    return {
      type: AssetType.Token,
      chainId,
      address: segments.erc20.toLowerCase(),
    };
  }

  throw new Error(
    `attempted to parse asset id with unknown namespaces(s): ${id}`
  );
}
