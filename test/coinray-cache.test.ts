"use strict"

import fs from "fs";
import Coinray from "../lib";
import CoinrayCache from "../lib/coinray-cache";

jest.setTimeout(30000);

// TODO
const coinrayToken = "eyJraWQiOiJSRVVrOGZZVnNveXBSUDIzIiwiYWxnIjoiSFMyNTYifQ.eyJpc3MiOiJSRVVrOGZZVnNveXBSUDIzIiwic3ViIjoiNzZlYzU0MWUtZjI3Ny00MzQ2LTk2YmUtODcxNjhiYzIxNTJhIiwiZXhwIjoxNzYxMjg3ODYzfQ.sCqL9zz2YaoEKEGKcZA_W-b-pAsL8RjzwCUoxsMnXyQ"
const coinray = new Coinray(coinrayToken)
const coinrayCache = new CoinrayCache(coinrayToken, {apiEndpoint: "https://api.coinray.eu"})

beforeAll(async () => {
  await coinrayCache.initialize()
  // console.debug(coinrayCache.getExchanges().length)
})
afterAll(() => {
  coinray.destroy()
  coinrayCache.destroy()
})

describe("searchMarkets", () => {
  test("query `trx` should NOT return non-TRX markets", async () => {
    const resultMap = coinrayCache.searchMarkets("trx")

    const nonTrxMarket = Object.values(resultMap).find(({exchangeCode, baseCurrency, quoteCurrency}) => {
      return !baseCurrency.toLowerCase().includes("trx") && !quoteCurrency.toLowerCase().includes("trx")
    })

    expect(!!nonTrxMarket).toBeFalsy()
  })

  test("query `hubi` should return markets in HUBI", async () => {
    const resultMap = coinrayCache.searchMarkets("hubi")

    const hubiMarket = Object.values(resultMap).find(({exchangeCode}) => {
      return exchangeCode.toLowerCase() === "hubi"
    })


    expect(!!hubiMarket).toBeTruthy()
  })

  test("query `hit` should return non-HIT markets in HITB, and also HIT-markets not in HITB", async () => {
    const resultMap = coinrayCache.searchMarkets("hit")

    const nonHitMarket = Object.values(resultMap).find(({exchangeCode, baseCurrency, quoteCurrency}) => {
      return exchangeCode.toLowerCase() === "hitb" && baseCurrency.toLowerCase() !== "hit" && quoteCurrency.toLowerCase() !== "hit"
    })
    expect(!!nonHitMarket).toBeTruthy()

    const hitNonHitbMarket = Object.values(resultMap).find(({exchangeCode, baseCurrency, quoteCurrency}) => {
      return exchangeCode.toLowerCase() !== "hitb" && (baseCurrency.toLowerCase() === "hit" || quoteCurrency.toLowerCase() === "hit")
    })
    expect(!!nonHitMarket).toBeTruthy()
  })

  test("query `hit/eth` should NOT return non-HIT markets in HITB, and should return ONLY markets that match `hit` and `eth` in currencies", async () => {
    const resultMap = coinrayCache.searchMarkets("hit/eth")

    const nonHitMarket = Object.values(resultMap).find(({exchangeCode, baseCurrency, quoteCurrency}) => {
      return exchangeCode.toLowerCase() === "hitb" && !baseCurrency.toLowerCase().includes("hit") && !quoteCurrency.toLowerCase().includes("eth")
    })
    expect(!!nonHitMarket).toBeFalsy()

    const hitEthMarkets = Object.values(resultMap).filter(({exchangeCode, baseCurrency, quoteCurrency}) => {
      return (baseCurrency.toLowerCase().includes("hit") && quoteCurrency.toLowerCase().includes("eth")) ||
        (quoteCurrency.toLowerCase().includes("hit") && baseCurrency.toLowerCase().includes("eth"))
    })
    expect(hitEthMarkets.length).toBeGreaterThan(0)
    expect(hitEthMarkets.length).toEqual(Object.values(resultMap).length)
  })

  test("query `hit/` and `/hit` should ONLY return markets with base or quote containing `hit`", async () => {
    const resultMap1 = coinrayCache.searchMarkets("hit/")
    const resultMap2 = coinrayCache.searchMarkets("/hit")

    const hitMarkets = [...Object.values(resultMap1), ...Object.values(resultMap2)]
      .filter(({exchangeCode, baseCurrency, quoteCurrency}) => {
        return quoteCurrency.toLowerCase().includes("hit") || baseCurrency.toLowerCase().includes("hit")
      })
    expect(hitMarkets.length).toBeGreaterThan(0)
    expect(hitMarkets.length).toEqual([...Object.values(resultMap1), ...Object.values(resultMap2)].length)
  })
})

describe("using cache", () => {
  test("cache is written and used, initialize() is faster", async () => {
    const EXCHANGES_PATH = "./test/exchanges.json"
    const onStoreCache = jest.fn(async (apiCache) => {
      const content = JSON.stringify(apiCache)
      apiCache.exchanges.forEach(({code}) => {
        expect(apiCache.markets[code].length).toBeGreaterThan(0)
      })

      try {
        fs.writeFileSync(EXCHANGES_PATH, content)
        // console.log("Coinray initialized! Data was written to:", EXCHANGES_PATH)
      } catch (err) {
        console.error(err)
      }
    })

    const readCache = () => fs.existsSync(EXCHANGES_PATH) ? JSON.parse(fs.readFileSync(EXCHANGES_PATH, "utf8")) : undefined

    let start

    const coinrayCache1 = new CoinrayCache(coinrayToken, {apiEndpoint: "https://api.coinray.eu"}, undefined, {
      apiCache: undefined,
      onStoreCache
    })
    start = Date.now()
    await coinrayCache1.initialize()
    const initDurationNoCache = Date.now() - start

    let apiCache = readCache()
    expect(apiCache.exchanges.length).toBeGreaterThan(0)
    expect(Object.keys(apiCache.markets).length).toBeGreaterThan(0)
    expect(onStoreCache.mock.calls.length).toEqual(1)

    const coinrayCache2 = new CoinrayCache(coinrayToken, {apiEndpoint: "https://api.coinray.eu"}, undefined, {
      apiCache,
      onStoreCache
    })
    start = Date.now()
    await coinrayCache2.initialize()
    const initDurationCached = Date.now() - start

    expect(Object.keys(coinrayCache2.getExchanges()).length).toBeGreaterThan(0)
    // initDurationCached will probably be less than /2, but a 2x should be a reliable test
    expect(initDurationCached).toBeLessThan(initDurationNoCache / 2)
    // a 2nd onStoreCache call IS done, but not awaited
    expect(onStoreCache.mock.calls.length).toEqual(1)
  })
})
