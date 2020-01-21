import BigNumber from "bignumber.js";

export interface MarketParam {
  coinraySymbol: string
}

export interface Candle {
  time: Date,
  open: BigNumber,
  high: BigNumber,
  low: BigNumber,
  close: BigNumber,
  baseVolume: BigNumber,
  quoteVolume: BigNumber,
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

export interface OrderBookEntry {
  price: BigNumber,
  quantity: BigNumber
}

export interface OrderBook {
  seq: number,
  asks: OrderBookEntry[],
  bids: OrderBookEntry[],
}

export interface Trade {
  id: string,
  time: Date,
  price: BigNumber,
  quantity: BigNumber,
  type: "sell" | "buy"
}

export interface TradeList {
  coinraySymbol: string,
  trades: Trade[]
}

export enum OrderType {
  LIMIT = "limit",
  MARKET = "market",
  LIMIT_LADDER = "limitLadder",
}

export enum OrderSide {BUY = "buy", SELL = "sell"}

export interface BaseParams {
  encryptedApiKey: string,
  coinraySymbol: string,
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
