"use strict"

jest.setTimeout(30000);

import Coinray from "../lib";
import CoinrayCache from "../lib/coinray-cache";

const coinrayToken = "********"
const coinray = new Coinray(coinrayToken)
const coinrayCache = new CoinrayCache(coinray)

beforeAll(async () => {
  await coinrayCache.initialize()
})

describe("searchMarkets", () => {
  test("query `trx` should NOT return non-TRX markets", async () => {
    const resultMap = coinrayCache.searchMarkets("trx")

    const nonTrxMarket = Object.values(resultMap).find(({exchangeCode, baseCurrency, quoteCurrency}) => {
      return baseCurrency.toLowerCase() !== "trx" && quoteCurrency.toLowerCase() !== "trx"
    })
    expect(!!nonTrxMarket).toBeFalsy()
  })

  test("query `btrx` should return markets in BTRX", async () => {
    const resultMap = coinrayCache.searchMarkets("btrx")

    const btrxMarket = Object.values(resultMap).find(({exchangeCode}) => {
      return exchangeCode.toLowerCase() === "btrx"
    })
    expect(!!btrxMarket).toBeTruthy()
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
      return exchangeCode.toLowerCase() === "hitb" && !quoteCurrency.toLowerCase().includes("hit") && !baseCurrency.toLowerCase().includes("eth")
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
