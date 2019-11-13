export enum OrderSide {
  BUY = "buy",
  SELL = "sell"
}

export enum OrderType {
  MARKET = "MARKET",
  LIMIT = "LIMIT",
  STOP_LOSS = "STOP_LOSS",
  STOP_LOSS_LIMIT = "STOP_LOSS_LIMIT",
  TAKE_PROFIT = "TAKE_PROFIT",
  TAKE_PROFIT_LIMIT = "TAKE_PROFIT_LIMIT",
}

export interface CreateOrderParams {
  credentials: object,
  coinraySymbol: string,
  type: OrderType,
  side: OrderSide,
  quantity: number,
  price?: number,
  stopPrice?: number,
}
