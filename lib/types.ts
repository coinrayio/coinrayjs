import BigNumber from "bignumber.js";
import Market from "./market";

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

export interface MarketMap {
  [key: string]: Market;
}

export interface MarketQuery {
  query: string,
  marketProperty: string
}

export interface OrderBookSide {
  [key: string]: BigNumber
}

export interface OrderBook {
  minSeq: number,
  maxSeq: number,
  asks: OrderBookSide,
  bids: OrderBookSide,
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
  MARKET = "MARKET",
  LIMIT = "LIMIT",
  LIMIT_LADDER = "LIMIT_LADDER",
  STOP_LOSS = "STOP_LOSS",
  OCO = "OCO",
  STOP_LOSS_LIMIT = "STOP_LOSS_LIMIT",
  STOP_LOSS_MARKET = "STOP_LOSS_MARKET",
  TAKE_PROFIT = "TAKE_PROFIT",
  TAKE_PROFIT_LIMIT = "TAKE_PROFIT_LIMIT",
  TAKE_PROFIT_MARKET = "TAKE_PROFIT_MARKET",
}

export enum MarginType {
  CROSSED = "CROSSED",
  ISOLATED = "ISOLATED"
}

export enum OrderStatus {
  OPEN = "open",
  CLOSED = "closed",
  CANCELED = "canceled"
}

export enum OrderSide {BUY = "buy", SELL = "sell"}

export enum BalanceLimit {QUOTE = "quote", BASE = "base", NONE = "none"}

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
  orderType: OrderType,
  orderId: string
}

export interface BaseOrderParams {
  externalId?: string
  coinraySymbol: string
  precisionBase: number
  precisionQuote: number
  precisionPrice: number
  minBase: BigNumber
  minQuote: BigNumber
  makerFee: BigNumber
  takerFee: BigNumber
  side: OrderSide
  balances: MarketBalance
  balanceLimit?: BalanceLimit
}

export interface Balance {
  currency: string,
  available: BigNumber,
  inOrders: BigNumber,
  total: BigNumber,
  initialMargin?: BigNumber
  openOrderInitialMargin?: BigNumber
  positionInitialMargin?: BigNumber
  unrealizedProfit?: BigNumber
  crossWalletBalance?: BigNumber
  crossUnrealizedProfit?: BigNumber
}

export interface MarketBalance {
  [key: string]: Balance,

  base: Balance,
  quote: Balance
}
