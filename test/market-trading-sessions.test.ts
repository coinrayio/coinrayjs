import {describe, test, expect} from "vitest"
import Market from "../lib/market"

const baseMarketData = {
  id: 1,
  coinraySymbol: "BITG_USDT_RXYZ",
  symbol: "RXYZUSDT",
  symbolAlt: "RXYZUSDT",
  quoteCurrency: "usdt",
  underlyingQuoteCurrency: "usdt",
  baseLogoUrl: null,
  baseCurrency: "rxyz",
  exchangeCode: "BITG",
  status: "ACTIVE",
  note: "",
  volume: "0",
  quoteVolume: "0",
  btcVolume: "0",
  usdVolume: "0",
  websocket: true,
  openPrice: "0",
  highPrice: "0",
  lowPrice: "0",
  precisionBase: 8,
  precisionPrice: 2,
  precisionQuote: 8,
  minBase: 0,
  minQuote: 0,
  maxBase: "0",
  maxBaseMarket: "0",
  maxQuote: "0",
  minTrade: "0",
  maxTrade: null,
  makerFee: 0,
  takerFee: 0,
  change: 0,
  delistedOn: null,
  exchangeUrl: "",
  lastPrice: "0",
  baseToUsd: "0",
  quoteToUsd: "0",
  askPrice: "0",
  bidPrice: "0",
  updatedAt: "2026-07-22T00:00:00Z",
  supportedOrderTypes: [],
}

const fakeApi: any = {}
const fakeExchange: any = {isFutures: false, supportedOrderTypes: []}

describe("Market trading sessions fields", () => {
  test("parses symbolTv, groupName, tradingSessions and syntheticTrades", () => {
    const market = Market.Create({
      ...baseMarketData,
      symbolTv: "RXYZUSDT",
      groupName: "TradFi",
      syntheticTrades: true,
      tradingSessions: [
        {phase: "regular", timezone: "America/New_York", days: [1, 2, 3, 4, 5], open: "09:30", close: "16:00"},
      ],
    }, fakeApi, fakeExchange)

    expect(market.symbolTv).toBe("RXYZUSDT")
    expect(market.groupName).toBe("TradFi")
    expect(market.syntheticTrades).toBe(true)
    expect(market.tradingSessions).toHaveLength(1)
    expect(market.tradingSessions![0].phase).toBe("regular")

    const cloned = market.clone()
    expect(cloned.groupName).toBe("TradFi")
    expect(cloned.tradingSessions).toHaveLength(1)
    expect(cloned.syntheticTrades).toBe(true)
  })

  test("defaults when fields are absent", () => {
    const market = Market.Create(baseMarketData, fakeApi, fakeExchange)

    expect(market.symbolTv).toBeUndefined()
    expect(market.groupName).toBeUndefined()
    expect(market.tradingSessions).toBeNull()
    expect(market.syntheticTrades).toBe(false)
  })
})
