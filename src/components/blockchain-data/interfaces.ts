export interface MessageObject {
  platform?: string;
  username: string;
  text: string;
  filteredText: string;
  hasBeenRead: boolean;
  timestamp: Date;
  message_id: string;
}

export interface Trade {
  tx: string;
  amount: number;
  priceUsd: number;
  volume: number;
  type: 'buy' | 'sell';
  wallet: string;
  time: number;
  program: string;
}

export interface TradeResponse {
  trades: Trade[];
  tokenAddress: string;
}

export interface PriceData {
  price: number;
  priceQuote: number;
  liquidity: number;
  marketCap: number;
  lastUpdated: number;
}

export interface Milestone {
  marketCap: number;
  description: string;
  hasBeenReached: boolean;
}

export interface TokenData {
  token: {
    name: string;
    symbol: string;
    mint: string;
    uri: string;
    decimals: number;
    hasFileMetaData: boolean;
    createdOn: string;
    description: string;
    image: string;
    showName: boolean;
  };
  pools: {
    poolId: string;
    liquidity: {
      quote: number;
      usd: number;
    };
    price: {
      quote: number;
      usd: number;
    };
    tokenSupply: number;
    lpBurn: number;
    tokenAddress: string;
    marketCap: {
      quote: number;
      usd: number;
    };
    decimals: number;
    security: {
      freezeAuthority: string | null;
      mintAuthority: string | null;
    };
    quoteToken: string;
    market: string;
    deployer: string;
    lastUpdated: number;
    createdAt: number;
    curve: string;
    txns: {
      buys: number;
      total: number;
      volume: number;
      sells: number;
    };
  }[];
  events: {
    [timeframe: string]: {
      priceChangePercentage: number;
    };
  };
  risk: {
    rugged: boolean;
    risks: {
      name: string;
      description: string;
      level: string;
      score: number;
    }[];
    score: number;
  };
  buys: number;
  sells: number;
  txns: number;
}
