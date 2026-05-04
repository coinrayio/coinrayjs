import {describe, test, expect} from "vitest"
import BigNumber from "bignumber.js"
import Market from "../lib/market"

const baseMarketData = {
  id: 1,
  coinraySymbol: "OKEX_USDT_BTC-PERP",
  symbol: "BTC-USDT-SWAP",
  symbolAlt: "BTC-USDT-SWAP",
  quoteCurrency: "usdt",
  underlyingQuoteCurrency: "usdt",
  baseLogoUrl: null,
  baseCurrency: "btc",
  exchangeCode: "OKEX",
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
  updatedAt: "2026-05-04T00:00:00Z",
  supportedOrderTypes: [],
}

const fakeApi: any = {}
const fakeExchange: any = {isFutures: true, supportedOrderTypes: []}

describe("Market.futuresSettings", () => {
  test("parses all fields on a futures market with full futuresSettings payload", () => {
    const market = Market.Create({
      ...baseMarketData,
      futuresSettings: {
        tenor: "perp_swap",
        margin: "usdt",
        expiresAt: null,
        fundingIntervalSeconds: 28800,
        maxLeverage: "125",
        groupName: "Perp",
      },
    }, fakeApi, fakeExchange)

    expect(market.futuresSettings).toBeDefined()
    expect(market.futuresSettings!.tenor).toBe("perp_swap")
    expect(market.futuresSettings!.margin).toBe("usdt")
    expect(market.futuresSettings!.expiresAt).toBeNull()
    expect(market.futuresSettings!.fundingIntervalSeconds).toBe(28800)
    expect(BigNumber.isBigNumber(market.futuresSettings!.maxLeverage)).toBe(true)
    expect(market.futuresSettings!.maxLeverage!.toString()).toBe("125")
    expect(market.futuresSettings!.groupName).toBe("Perp")
    expect(market.groupName).toBe("Perp")
  })

  test("parses dated future with expiresAt set and groupName 'Futures'", () => {
    const market = Market.Create({
      ...baseMarketData,
      futuresSettings: {
        tenor: "dated_future",
        margin: "usd",
        expiresAt: "2026-12-26T08:00:00Z",
        fundingIntervalSeconds: null,
        maxLeverage: "100",
        groupName: "Futures",
      },
    }, fakeApi, fakeExchange)

    expect(market.futuresSettings!.tenor).toBe("dated_future")
    expect(market.futuresSettings!.expiresAt).toBeInstanceOf(Date)
    expect(market.futuresSettings!.expiresAt!.toISOString()).toBe("2026-12-26T08:00:00.000Z")
    expect(market.futuresSettings!.fundingIntervalSeconds).toBeNull()
    expect(market.groupName).toBe("Futures")
  })

  test("leaves groupName undefined when missing from futuresSettings", () => {
    const market = Market.Create({
      ...baseMarketData,
      futuresSettings: {
        tenor: "extended_perp",
        margin: "usdt",
        expiresAt: null,
        fundingIntervalSeconds: 28800,
        maxLeverage: "50",
      },
    }, fakeApi, fakeExchange)

    expect(market.futuresSettings).toBeDefined()
    expect(market.futuresSettings!.tenor).toBe("extended_perp")
    expect(market.futuresSettings!.groupName).toBeUndefined()
    expect(market.groupName).toBeUndefined()
  })

  test("spot market without futuresSettings leaves field undefined", () => {
    const market = Market.Create(baseMarketData, fakeApi, fakeExchange)

    expect(market.futuresSettings).toBeUndefined()
    expect(market.groupName).toBeUndefined()
  })
})
