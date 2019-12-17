import BigNumber from "bignumber.js";

export interface MarketParam {
  coinraySymbol: string
}

export interface CandleParam {
  coinraySymbol: string,
  resolution: string
}

export interface CandlesParam {
  coinraySymbol: string,
  resolution: string,
  start?: number,
  end?: number
}

export interface Orderbook {
  seq: number,
  asks: [number, number],
  bids: [number, number],
}

export interface Trade {
  id: string,
  time: Date,
  price: number,
  quantity: number,
  type: "sell" | "buy"
}

export interface Candle {
  time: number,
  open: number,
  high: number,
  low: number,
  close: number,
  baseVolume: number,
  quoteVolume: number,
}

export enum OrderType {
  LIMIT = "limit",
  MARKET = "market",
  LIMIT_LADDER = "limitLadder",
}

export enum OrderSide {BUY = "buy", SELL = "sell"}

export interface BaseParams {
  encryptedApiKey: object,
  coinraySymbol?: string,
}

export interface CreateOrderParams extends BaseParams {
  type: OrderType,
  side: OrderSide,
  quantity: BigNumber,
  price?: BigNumber,
  stopPrice?: BigNumber,
}

export interface UpdateOrderParams extends BaseParams {
  orderId: string,
  type: OrderType,
  side: OrderSide,
  quantity: BigNumber,
  price?: BigNumber,
  stopPrice?: BigNumber,
}

export interface CancelOrderParams extends BaseParams {
  orderId: string
}

export interface BaseOrderParams {
  exchangeCode: string
  quoteCurrency: string
  baseCurrency: string
  precisionAmount: number
  precisionPrice: number
  minBaseAmount: BigNumber
  makerFee: BigNumber
  takerFee: BigNumber
  side: OrderSide
  balances: MarketBalance
}

export interface Balance {
  currency: string,
  available: number,
  in_orders: number,
  total: number
}

export interface MarketBalance {
  [key: string]: Balance,

  base: Balance,
  quote: Balance
}
