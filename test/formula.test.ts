import {describe, test, expect, vi} from "vitest"
import CoinrayCache from "../lib/coinray-cache"
import Coinray from "../lib/coinray"
import {alignCandles, combineCandles, evalFormula, formulaCandles, formulaLegs, formulaPrecision, formulaSymbolInfo, isFormula, parseFormula} from "../lib/formula"
import {Candle} from "../lib/types"

const c = (t: number, open: number, high: number, low: number, close: number): Candle =>
  ({time: new Date(t * 1000), open, high, low, close, baseVolume: 1, quoteVolume: 1, numTrades: 1})

const A = "BINA_USDT_XYZ", B = "BINA_USDT_BTC"

describe("parseFormula", () => {
  test("isFormula", () => {
    expect(isFormula(`${A} / ${B}`)).toBe(true)
    expect(isFormula(A)).toBe(false)
    expect(isFormula("OKEXF_USDT_BTC-SWAP")).toBe(false)
  })

  test("precedence, parens, unary minus, aliases", () => {
    const val = (f: string) => {
      const legs = {[A]: 2, [B]: 3}
      const node = parseFormula(f)
      return evalFormula(node, (leg: string) => legs[leg])
    }
    expect(val(`${A} + ${B} * 2`)).toBe(8)
    expect(val(`(${A} + ${B}) * 2`)).toBe(10)
    expect(val(`-${A} + 1`)).toBe(-1)
    expect(val(`${A} × ${B} ÷ 2`)).toBe(3)
    expect(val(`${A} - ${B}`)).toBe(-1)
    expect(formulaLegs(parseFormula(`${A} / ${B} + ${A}`))).toEqual([A, B])
  })

  test("rejects garbage", () => {
    expect(() => parseFormula("1 + 2")).toThrow(/no markets/)
    expect(() => parseFormula(`${A} / `)).toThrow()
    expect(() => parseFormula(`(${A}`)).toThrow(/missing \)/)
    expect(() => parseFormula(`${A} % ${B}`)).toThrow()
    expect(() => parseFormula("BTC / ETH")).toThrow(/Invalid market/)
  })
})

describe("candles", () => {
  const node = parseFormula(`${A} / ${B}`)

  test("quote conversion XYZ/USDT ÷ BTC/USDT = XYZ/BTC", () => {
    const bar = combineCandles(node, {[A]: c(0, 10, 12, 9, 11), [B]: c(0, 100000, 110000, 90000, 100000)}, new Date(0))!
    expect(bar.open).toBeCloseTo(0.0001)
    expect(bar.close).toBeCloseTo(0.00011)
    expect(bar.high).toBeGreaterThanOrEqual(Math.max(bar.open, bar.close))
    expect(bar.low).toBeLessThanOrEqual(Math.min(bar.open, bar.close))
    expect(bar.baseVolume).toBe(0)
  })

  test("high/low clamp covers open/close when a leg is a denominator", () => {
    // field-wise high = 12 / 200 < close = 11 / 50
    const bar = combineCandles(node, {[A]: c(0, 10, 12, 9, 11), [B]: c(0, 100, 200, 50, 50)}, new Date(0))!
    expect(bar.high).toBeCloseTo(11 / 50)
  })

  test("divide by zero skips the bar", () => {
    expect(combineCandles(node, {[A]: c(0, 1, 1, 1, 1), [B]: c(0, 0, 0, 0, 0)}, new Date(0))).toBeNull()
  })

  test("align starts at latest first bar and forward-fills gaps", () => {
    const rows = alignCandles([A, B], {
      [A]: [c(0, 1, 1, 1, 1), c(60, 2, 2, 2, 2), c(180, 4, 4, 4, 4)],
      [B]: [c(60, 1, 1, 1, 1), c(120, 1, 1, 1, 1), c(180, 2, 2, 2, 2)],
    })
    expect(rows.map((r) => r.time.getTime() / 1000)).toEqual([60, 120, 180])
    expect(rows[1].legs[A]).toMatchObject({open: 2, close: 2, baseVolume: 0})
    const bars = formulaCandles(node, {[A]: [c(60, 2, 2, 2, 2), c(180, 4, 4, 4, 4)], [B]: [c(60, 1, 1, 1, 1), c(120, 1, 1, 1, 1), c(180, 2, 2, 2, 2)]})
    expect(bars.map((b) => b.close)).toEqual([2, 2, 2])
  })

  test("precision", () => {
    expect(formulaPrecision(65000)).toBe(2)
    expect(formulaPrecision(1.5)).toBe(4)
    expect(formulaPrecision(0.00002345)).toBe(9)
    expect(formulaPrecision(NaN)).toBe(8)
  })

  test("symbol info", () => {
    const markets = {
      [A]: {exchangeCode: "BINA", baseCurrency: "XYZ", quoteCurrency: "USDT", lastPrice: {toNumber: () => 2}},
      [B]: {exchangeCode: "BINA", baseCurrency: "BTC", quoteCurrency: "USDT", lastPrice: {toNumber: () => 100000}},
      "KRKN_USD_BTC": {exchangeCode: "KRKN", baseCurrency: "BTC", quoteCurrency: "USD"},
    }
    const info = formulaSymbolInfo(`(${A} / ${B})`, (s) => markets[s])
    expect(info.name).toBe("(XYZ/USDT ÷ BTC/USDT)")
    expect(info.pricePrecision).toBe(9)
    expect(formulaSymbolInfo(`${B} - KRKN_USD_BTC`, (s) => markets[s]).name).toBe("BINA:BTC/USDT − KRKN:BTC/USD")
    expect(() => formulaSymbolInfo(`${A} / BINA_USDT_NOPE`, (s) => markets[s])).toThrow(/Unknown market/)
  })
})

describe("CoinrayCache formula symbols", () => {
  const listeners: Record<string, ((p: any) => void)[]> = {}
  // the proxy evaluates formulas itself unless proxyRejects is set
  let proxyRejects = false
  const fakeApi = {
    fetchCandles: async ({coinraySymbol}) => {
      if (isFormula(coinraySymbol)) {
        if (proxyRejects) throw new Error("Invalid exchange code")
        return [c(0, 7, 7, 7, 7)]
      }
      return coinraySymbol === A
        ? [c(0, 10, 10, 10, 10), c(60, 20, 20, 20, 20)]
        : [c(0, 5, 5, 5, 5), c(60, 5, 5, 5, 5)]
    },
    subscribeCandles: async ({coinraySymbol}, cb) => {
      (listeners[coinraySymbol] ??= []).push(cb)
      return cb
    },
    unsubscribeCandles: async ({coinraySymbol}, cb) => {
      listeners[coinraySymbol] = listeners[coinraySymbol].filter((l) => l !== cb)
    },
  }
  const cache = new CoinrayCache("", {apiEndpoint: "http://localhost"} as any)
  ;(cache as any).apis = new Map([["BINA", fakeApi]])
  const formula = `${A} / ${B}`

  test("fetchCandles asks the proxy for the formula in one request", async () => {
    const bars = await cache.fetchCandles({coinraySymbol: formula, resolution: "1", start: 0, end: 60})
    expect(bars.map((b) => b.close)).toEqual([7])
  })

  test("fetchCandles combines the legs when the proxy rejects the formula", async () => {
    proxyRejects = true
    try {
      const bars = await cache.fetchCandles({coinraySymbol: formula, resolution: "1", start: 0, end: 60})
      expect(bars.map((b) => b.close)).toEqual([2, 4])
    } finally {
      proxyRejects = false
    }
  })

  test("fetchCandles combines the legs for seconds resolutions", async () => {
    const bars = await cache.fetchCandles({coinraySymbol: formula, resolution: "1S", start: 0, end: 60})
    expect(bars.map((b) => b.close)).toEqual([2, 4])
  })

  test("unknown exchange throws", async () => {
    await expect(cache.fetchCandles({coinraySymbol: `${A} / NOPE_USDT_BTC`, resolution: "1"})).rejects.toThrow(/Unknown exchange/)
  })

  test("subscribe emits once all legs ticked, unsubscribe removes legs", async () => {
    const got: any[] = []
    const cb = (p: any) => got.push(p)
    await cache.subscribeCandles({coinraySymbol: formula, resolution: "1"}, cb)
    expect(listeners[A]).toHaveLength(1)
    listeners[A][0]({candle: c(60, 10, 10, 10, 10)})
    expect(got).toHaveLength(0)
    listeners[B][0]({candle: c(0, 5, 5, 5, 5)})
    expect(got).toHaveLength(1)
    expect(got[0]).toMatchObject({coinraySymbol: formula, candle: {close: 2}})
    expect(got[0].candle.time.getTime()).toBe(60000)
    await cache.unsubscribeCandles({coinraySymbol: formula, resolution: "1"}, cb)
    expect(listeners[A]).toHaveLength(0)
    expect(listeners[B]).toHaveLength(0)
  })
})

describe("Coinray formula requests", () => {
  test("formula symbols are url encoded, start time uses v2", async () => {
    const api = new Coinray("", {apiEndpoint: "http://localhost"} as any)
    const get = vi.spyOn(api, "get").mockResolvedValue({result: {startTime: "2020-01-01T00:00:00Z", candles: []}, _headers: {}})
    await api.fetchFirstCandleTime({coinraySymbol: `${A} + ${B}`, resolution: "1"})
    expect(get).toHaveBeenCalledWith("candles/start-time", {version: "v2", params: {symbol: "BINA_USDT_XYZ%20%2B%20BINA_USDT_BTC", resolution: "1"}})
    await api.fetchFirstCandleTime({coinraySymbol: A, resolution: "1"})
    expect(get).toHaveBeenLastCalledWith("candles/start-time", {version: "v1", params: {symbol: A, resolution: "1"}})
  })

  test("a formula's open candles skip the websocket snapshot", async () => {
    const api = new Coinray("", {apiEndpoint: "http://localhost"} as any)
    const now = Math.floor(Date.now() / 1000)
    const get = vi.spyOn(api, "get").mockImplementation(async (endpoint) => ({
      result: {candles: endpoint === "candles/open" ? [[now - 60, "2", "2", "2", "2", "0", "0"]] : []}, _headers: {},
    }))
    const ws = vi.spyOn(api, "getWebsocketCandles")
    await api.fetchCandles({coinraySymbol: `${A} / ${B}`, resolution: "1", start: now - 3600, end: now})
    expect(ws).not.toHaveBeenCalled()
    expect(get.mock.calls[0]).toEqual(["candles/open", {version: "v2", params: {symbol: "BINA_USDT_XYZ%20%2F%20BINA_USDT_BTC", resolution: "1"}}])
  })
})
