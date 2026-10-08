import {describe, test, expect} from "vitest"
import BigNumber from "bignumber.js"
import CoinrayCache from "../lib/coinray-cache"
import FormulaMarket from "../lib/formula-market"

const market = (exchangeCode: string, base: string, quote: string, last: number, open: number, status = "ACTIVE") =>
  ({exchangeCode, baseCurrency: base, quoteCurrency: quote, lastPrice: new BigNumber(last), openPrice: new BigNumber(open), status}) as any

const ETH = "BINA_USDT_ETH", BTC = "BINA_USDT_BTC", KBTC = "KRKN_USD_BTC"

describe("FormulaMarket", () => {
  const markets: Record<string, any> = {
    [ETH]: market("BINA", "ETH", "USDT", 2000, 1800),
    [BTC]: market("BINA", "BTC", "USDT", 80000, 80000),
    [KBTC]: market("KRKN", "BTC", "USD", 80000, 80000),
  }
  const fm = (formula: string) => new FormulaMarket(formula, (s) => markets[s])

  test("prices and 24h change from the legs", () => {
    const m = fm(`${ETH} / ${BTC}`)
    expect(m.lastPrice.toNumber()).toBe(0.025)
    expect(m.openPrice.toNumber()).toBe(0.0225)
    expect(m.change).toBeCloseTo(11.111, 3)
    expect(m.displayName).toBe("ETH/USDT ÷ BTC/USDT")
    expect(m.precisionPrice).toBe(6)
    expect(m.exchangeCode).toBe("BINA")
    expect(m.status).toBe("ACTIVE")
    expect(m.usdVolume).toBeUndefined()
    expect(m.marketCap).toBeUndefined()
  })

  test("follows leg updates", () => {
    const m = fm(`${ETH} / ${BTC}`)
    markets[ETH] = market("BINA", "ETH", "USDT", 4000, 1800)
    expect(m.lastPrice.toNumber()).toBe(0.05)
    expect(m.precisionPrice).toBe(6)
    markets[ETH] = market("BINA", "ETH", "USDT", 2000, 1800)
  })

  test("cross-exchange formula has no single exchange", () => {
    const m = fm(`${BTC} - ${KBTC}`)
    expect(m.exchangeCodes).toEqual(["BINA", "KRKN"])
    expect(m.exchangeCode).toBeUndefined()
    expect(m.lastPrice.toNumber()).toBe(0)
  })

  test("missing legs leave prices undefined but keep the object", () => {
    const m = fm(`${ETH} / BINA_USDT_NOPE`)
    expect(m.missingLegs).toEqual(["BINA_USDT_NOPE"])
    expect(m.displayName).toBe(`${ETH} / BINA_USDT_NOPE`)
    expect(m.lastPrice).toBeUndefined()
    expect(m.change).toBeUndefined()
    expect(m.status).toBeUndefined()
    expect(m.precisionPrice).toBeUndefined()
  })

  test("status is the first non-active leg status", () => {
    markets.BINA_USDT_OLD = market("BINA", "OLD", "USDT", 1, 1, "INACTIVE")
    expect(fm(`BINA_USDT_OLD / ${BTC}`).status).toBe("INACTIVE")
  })

  test("no price (0) or division by zero gives undefined", () => {
    markets.BINA_USDT_ZERO = market("BINA", "ZERO", "USDT", 0, 0)
    expect(fm(`${ETH} / BINA_USDT_ZERO`).lastPrice).toBeUndefined()
    expect(fm(`${ETH} / (${BTC} - ${BTC})`).lastPrice).toBeUndefined()
  })
})

describe("CoinrayCache formula markets", () => {
  const cache = new CoinrayCache("", {apiEndpoint: "http://localhost"} as any)
  cache.initialized = true // no exchanges loaded, so every leg is unknown

  test("getFormulaMarket is undefined only when the formula doesn't parse", () => {
    expect(cache.getFormulaMarket(`${ETH} / `)).toBeUndefined()
    expect(cache.getFormulaMarket(ETH)).toBeUndefined()
    const m = cache.getFormulaMarket(`${ETH} / ${BTC}`)
    expect(m.missingLegs).toEqual([ETH, BTC])
    expect(cache.getFormulaMarket(`${ETH} / ${BTC}`)).toBe(m)
    expect(cache.getMarketOrFormula(`${ETH} / ${BTC}`)).toBe(m)
  })

  test("leases and ticker subscriptions expand formulas to their legs", () => {
    const release = cache.touchExchange([`(${ETH} + ${KBTC}) / 2`, "BINA_USDT_XRP"])
    expect([...(cache as any).leases.keys()].sort()).toEqual(["BINA", "KRKN"])
    release()
    cache.subscribeTickers("l", [`${ETH} / ${BTC}`, ETH])
    expect([...(cache as any).tickerSubscriptions.pendingAdditions.keys()]).toEqual([ETH, BTC])
  })

  // what the listener has pending to drop on the next flush
  const removals = (c: CoinrayCache) => [...(c as any).tickerSubscriptions.pendingRemovals.keys()].sort()
  const formula = `${ETH} / ${BTC}`

  test("unsubscribing a formula keeps legs another requested symbol still needs", () => {
    const c = new CoinrayCache("", {apiEndpoint: "http://localhost"} as any)
    c.subscribeTickers("rows", [ETH, formula])
    c.unsubscribeTickers("rows", [formula])
    expect(removals(c)).toEqual([BTC])
    c.destroy()
  })

  test("unsubscribing a plain symbol keeps it while a formula of the listener uses it", () => {
    const c = new CoinrayCache("", {apiEndpoint: "http://localhost"} as any)
    c.subscribeTickers("rows", [ETH, formula])
    c.unsubscribeTickers("rows", [ETH])
    expect(removals(c)).toEqual([])
    c.unsubscribeTickers("rows", [formula])
    expect(removals(c)).toEqual([BTC, ETH])
    c.destroy()
  })

  test("reset drops only legs the new set doesn't need", () => {
    const c = new CoinrayCache("", {apiEndpoint: "http://localhost"} as any)
    c.subscribeTickers("rows", [formula, KBTC])
    c.subscribeTickers("rows", [ETH], true)
    expect(removals(c)).toEqual([BTC, KBTC])
    c.destroy()
  })
})
