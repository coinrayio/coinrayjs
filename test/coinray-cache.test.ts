import {describe, test, expect, beforeAll, afterAll, vi} from "vitest"
import fs from "fs"
import Coinray from "../lib"
import CoinrayCache from "../lib/coinray-cache"

const token = import.meta.env.VITE_COINRAY_TOKEN ?? ""
const coinray = new Coinray(token)
const coinrayCache = new CoinrayCache(token, {apiEndpoint: "https://api.coinray.eu"})

beforeAll(async () => {
  await coinrayCache.initialize()
})
afterAll(() => {
  coinray.destroy()
  coinrayCache.destroy()
})

describe.skipIf(!token)("searchMarkets", () => {
  test("query `trx` should only return markets containing `trx` in base or quote", async () => {
    const resultMap = coinrayCache.searchMarkets("trx")

    const nonMatchingMarket = Object.values(resultMap).find(({baseCurrency, quoteCurrency}) => {
      return !baseCurrency.toLowerCase().includes("trx") && !quoteCurrency.toLowerCase().includes("trx")
    })
    expect(!!nonMatchingMarket).toBeFalsy()
  })

  test("query `bybi` should return markets in BYBI", async () => {
    const resultMap = coinrayCache.searchMarkets("bybi")

    const bybiMarket = Object.values(resultMap).find(({exchangeCode}) => {
      return exchangeCode.toLowerCase() === "bybi"
    })
    expect(!!bybiMarket).toBeTruthy()
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

    const hitEthMarkets = Object.values(resultMap).filter(({baseCurrency, quoteCurrency}) => {
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
      .filter(({baseCurrency, quoteCurrency}) => {
        return quoteCurrency.toLowerCase().includes("hit") || baseCurrency.toLowerCase().includes("hit")
      })
    expect(hitMarkets.length).toBeGreaterThan(0)
    expect(hitMarkets.length).toEqual([...Object.values(resultMap1), ...Object.values(resultMap2)].length)
  })
})

describe.skipIf(!token)("using cache", () => {
  test("cache is written and used, initialize() is faster", async () => {
    const EXCHANGES_PATH = "./test/exchanges.json"
    const onStoreCache = vi.fn(async (apiCache) => {
      const content = JSON.stringify(apiCache)
      apiCache.exchanges.forEach(({code}) => {
        expect(apiCache.markets[code].length).toBeGreaterThan(0)
      })

      try {
        fs.writeFileSync(EXCHANGES_PATH, content)
      } catch (err) {
        console.error(err)
      }
    })

    const readCache = () => fs.existsSync(EXCHANGES_PATH) ? JSON.parse(fs.readFileSync(EXCHANGES_PATH, "utf8")) : undefined

    let start

    const coinrayCache1 = new CoinrayCache(token, {apiEndpoint: "https://api.coinray.eu"}, undefined, {
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

    const coinrayCache2 = new CoinrayCache(token, {apiEndpoint: "https://api.coinray.eu"}, undefined, {
      apiCache,
      onStoreCache
    })
    start = Date.now()
    await coinrayCache2.initialize()
    const initDurationCached = Date.now() - start

    expect(Object.keys(coinrayCache2.getExchanges()).length).toBeGreaterThan(0)
    expect(initDurationCached).toBeLessThan(initDurationNoCache / 2)
    expect(onStoreCache.mock.calls.length).toEqual(1)
  })
})
