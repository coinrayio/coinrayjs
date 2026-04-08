import {describe, test, expect, beforeAll, afterAll} from "vitest"
import CoinrayCache from "../lib/coinray-cache"

const token = import.meta.env.VITE_COINRAY_TOKEN ?? ""
let coinrayCache = new CoinrayCache(token, {apiEndpoint: "https://api.coinray.eu"})

beforeAll(async () => {
  await coinrayCache.initialize()
})

afterAll(() => {
  coinrayCache.destroy()
})

describe.skipIf(!token)("CoinrayCache", () => {
  test("getExchanges() should return exchanges", async () => {
    let exchanges = coinrayCache.getExchanges()
    expect(Object.keys(exchanges).length).toBeGreaterThan(0)
  })

  // Skipped: no DEX exchanges available in the API as of 2026-04-08.
  // UNI3 (Uniswap v3) was previously returned by https://api.coinray.eu/v2/exchanges
  // with isDex: true and a custom apiEndpoint (https://dex.ams.coinray.eu).
  // This test verified that markets were fetched from that custom DEX endpoint.
  test.skip("UNI3 markets are filled (it should use the custom dex endpoint)", async () => {
    let markets = coinrayCache.getExchange("UNI3").markets
    expect(Object.keys(markets).length).toBeGreaterThan(10)
  })

  test("BINA markets are filled (it should use the default endpoint)", async () => {
    let markets = coinrayCache.getExchange("BINA").markets
    expect(Object.keys(markets).length).toBeGreaterThan(10)
  })
})
