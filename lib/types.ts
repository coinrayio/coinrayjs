import BigNumber from "bignumber.js";
import Market from "./market";

export interface MarketParam {
  coinraySymbol: string
}

export interface Candle {
  time: Date,
  open: number,
  high: number,
  low: number,
  close: number,
  baseVolume: number,
  quoteVolume: number,
  numTrades: number,
  skipVolume?: Boolean
}

export interface CandleParam {
  coinraySymbol: string,
  resolution: string,
  lastCandle?: Candle
}

export interface CandlesParam {
  coinraySymbol: string,
  resolution: string,
  start?: number,
  end?: number
  useWebSocket?: boolean,
}

export interface MarketMap {
  [key: string]: Market;
}

export interface MarketQuery {
  query: string,
  marketProperty: string
}

export interface OrderBookSide {
  [key: string]: number
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
  price: number,
  quantity: number,
  type: "sell" | "buy"
}

export interface FuturesSettings {
  tenor: "perp_swap" | "dated_future" | "extended_perp",
  margin: "usdt" | "usdc" | "usd" | "coin",
  expiresAt?: Date | null,
  fundingIntervalSeconds?: number | null,
  maxLeverage?: BigNumber | null,
  groupName?: string,
}

export interface TradingSession {
  phase: string,
  timezone: string,
  days: number[],
  open: string,
  close: string,
}

// Websocket ticker. Uppercase keys are 24h, lowercase are the current 1s candle (backend common::Ticker).
export interface Ticker {
  coinraySymbol: string,
  baseVolume: BigNumber, // 24h (BV)
  quoteVolume: BigNumber, // 24h (QV)
  btcVolume: BigNumber, // 24h (B)
  usdVolume: BigNumber, // 24h (U)
  openPrice24h: BigNumber,
  highPrice24h: BigNumber,
  lowPrice24h: BigNumber,
  baseVolume1s: BigNumber, // bv
  quoteVolume1s: BigNumber, // qv
  openPrice1s: BigNumber,
  highPrice1s: BigNumber,
  lowPrice1s: BigNumber,
  lastPrice: BigNumber,
  askPrice: BigNumber,
  bidPrice: BigNumber,
}

// 24h ticker from GET /api/v1/tickers, applied with Market.applySnapshot
export interface TickerSnapshot {
  coinraySymbol: string,
  lastPrice: BigNumber,
  askPrice: BigNumber,
  bidPrice: BigNumber,
  openPrice24h: BigNumber,
  highPrice24h: BigNumber,
  lowPrice24h: BigNumber,
  baseVolume: BigNumber,
  quoteVolume: BigNumber,
  btcVolume: BigNumber,
  usdVolume: BigNumber,
  baseToUsd: BigNumber,
  quoteToUsd: BigNumber,
  marketCap: BigNumber,
}

export interface MarketsUpdatedEvent {
  exchangeCodes: string[]
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

export enum ExchangeFeatures {
  HEDGE_MODE = "hedgeMode",
  HEDGE_MODE_ONLY = "hedgeModeOnly",
  ORDER_QUOTE_AMOUNT = "orderQuoteAmount",
  MARKET_BUY_QUOTE_ONLY = "marketBuyQuoteOnly",
  UPDATE_LEVERAGE_ONLY_ON_OPEN_POSITIONS = "updateLeverageOnlyOnOpenPositions",
  IGNORE_LEVERAGE_ON_QUICK_SYNC = "ignoreLeverageOnQuickSync",
  MULTIPLE_MARGIN_TYPE_POSITIONS = "multipleMarginTypePositions",
  SET_LEVERAGE_NOT_AVAILABLE = "setLeverageNotAvailable",
  SET_MARGIN_TYPE_NOT_AVAILABLE = "setMarginTypeNotAvailable",
  FIXED_CROSSED_LEVERAGE = "fixedCrossedLeverage",
  FAST_CONNECT = "fastConnect",
  UNIFIED_BALANCE = "unifiedBalance",
  NO_API_KEY_LINK = "noApiKeyLink",
}

export enum IpWhiteList {
  NONE = "NONE",
  LIST = "LIST",
  COMMA = "COMMA",
  COMMA_SPACE = "COMMA_SPACE",
  SPACE = "SPACE",
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

export enum TimeInForce {GTC = "gtc", FOK = "fok", IOC = "ioc"}

export enum BalanceLimit {QUOTE = "quote", BASE = "base", NONE = "none"}

export interface BaseParams {
  encryptedApiKey: string,
  coinraySymbol: string,
}

export interface SmartOrderParams {
  credential: string,
  coinraySymbol?: String
  type?: OrderType,
  side?: OrderSide,
  quantity?: BigNumber,
  price?: BigNumber,
  stopPrice?: BigNumber,
  allowParams?: string[],
  reduceOnly?: boolean,
  postOnly?: boolean,
  timeInForce?: TimeInForce,
}

export interface CreateOrderParams extends BaseParams {
  type: OrderType,
  side: OrderSide,
  quantity: BigNumber,
  price?: BigNumber,
  stopPrice?: BigNumber,
  reduceOnly?: boolean,
  postOnly?: boolean,
  timeInForce?: TimeInForce,
}

export interface UpdateOrderParams extends BaseParams {
  orderId: string,
  type: OrderType,
  side: OrderSide,
  quantity: BigNumber,
  price?: BigNumber,
  stopPrice?: BigNumber,
  reduceOnly?: boolean,
  postOnly?: boolean,
  timeInForce?: TimeInForce,
}

export interface CancelOrderParams extends BaseParams {
  orderType: OrderType,
  orderId: string
}

export interface AccountTestParams extends BaseParams {
  encryptedApiKey: string,
  exchangeCode: string
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
  reduceOnly?: boolean,
  postOnly?: boolean,
  timeInForce?: TimeInForce,
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

export interface ApiCache {
  exchanges?: Array<object>,
  markets: {
    [key: string]: Array<object>
  }
}

export interface CacheParams {
  apiCache: ApiCache,
  onStoreCache: {
    (apiCache: object): void;
  }
}
