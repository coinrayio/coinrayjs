import {describe, test, expect} from "vitest"
import Exchange from "../lib/exchange"

const api: any = {config: {apiEndpoint: "https://api", websocketEndpoint: "wss://ws"}}

const exchangeRow = (extra = {}) => ({
  id: 40, name: "Coinray Aggregate", code: "CRAY", websocket: true, active: true, tradingEnabled: false, tradingEnabledFrom: "",
  isFutures: false, isDex: false, logo: "", btcVolume: "0", usdVolume: "0", totalMarkets: 0,
  quoteCurrencies: ["USD", "MCAP", "DOM"], supportedResolutions: [], supportedFeatures: [], supportedOrderTypes: [], ...extra,
})

describe("Exchange.virtual", () => {
  test("is read from the exchange JSON", () => {
    expect(Exchange.Create(exchangeRow({virtual: true}), api).virtual).toBe(true)
  })

  test("defaults to false when absent", () => {
    expect(Exchange.Create(exchangeRow(), api).virtual).toBe(false)
  })

  test("follows update and survives clone", () => {
    const exchange = Exchange.Create(exchangeRow(), api)
    exchange.update(exchangeRow({virtual: true}))
    expect(exchange.virtual).toBe(true)
    expect(exchange.clone().virtual).toBe(true)
  })

  test("rejects a non-boolean value", () => {
    expect(() => Exchange.Create(exchangeRow({virtual: "yes"}), api)).toThrow()
  })
})
