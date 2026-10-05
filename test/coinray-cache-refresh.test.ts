import BigNumber from "bignumber.js"
import {describe, test, expect, beforeEach, afterEach, vi} from "vitest"
import CoinrayCache from "../lib/coinray-cache"
import Coinray from "../lib/coinray"
import TickerSubscriptions from "../lib/ticker-subscriptions"

const exchangeRow = (code: string) => ({
  id: 1, name: code, code, websocket: true, active: true, tradingEnabled: true, tradingEnabledFrom: "",
  isFutures: false, isDex: false, logo: "", btcVolume: "0", usdVolume: "0", totalMarkets: 0,
  quoteCurrencies: [], supportedResolutions: [], supportedFeatures: [], supportedOrderTypes: [],
})

const staticRow = (coinraySymbol: string, extra = {}) => {
  const [exchangeCode, quote, base] = coinraySymbol.split("_")
  return {
    id: 1, coinraySymbol, symbol: base + quote, symbolAlt: base + quote, quoteCurrency: quote,
    underlyingQuoteCurrency: quote, baseLogoUrl: null, baseCurrency: base, exchangeCode, status: "ACTIVE", note: "",
    websocket: true, precisionBase: 8, precisionPrice: 2, precisionQuote: 8, minBase: 0, minQuote: 0,
    maxBase: "0", maxBaseMarket: "0", maxQuote: "0", minTrade: "0", maxTrade: null, makerFee: 0, takerFee: 0,
    delistedOn: null, exchangeUrl: "", supportedOrderTypes: [], ...extra,
  }
}

const fullRow = (coinraySymbol: string, extra = {}) => ({
  ...staticRow(coinraySymbol), volume: "1", quoteVolume: "1", btcVolume: "1", usdVolume: "1",
  openPrice: "100", highPrice: "100", lowPrice: "100", change: 0, lastPrice: "100", baseToUsd: "1",
  quoteToUsd: "1", askPrice: "100", bidPrice: "100", updatedAt: "2026-09-29T00:00:00Z", marketCap: "0", ...extra,
})

const compactTicker = (s: string, price: number, open: number) => ({
  s, c: `${price}`, a: `${price + 1}`, b: `${price - 1}`, O: `${open}`, H: "300", L: "50",
  BV: "10", QV: "20", B: "30", U: "40", bu: "2", qu: "3", mc: "5000",
})

const networkError = () => Object.assign(new Error("Network Error"), {isAxiosError: true, response: undefined})
const notFound = () => Object.assign(new Error("Request failed"), {status: 404})

type Server = {
  exchanges: string[]
  markets: { [code: string]: any[] }
  price: number
  open: number
  etags: { [code: string]: string }
  tickers404: boolean
  tickersNetworkError?: boolean
  static404: boolean
  tickersGate?: Promise<void>
}

async function setup(codes = ["BINA", "KUCN", "OKEX"], {apiCache = undefined} = {}) {
  const server: Server = {
    exchanges: codes,
    markets: Object.fromEntries(codes.map((code) => [code, [fullRow(`${code}_USDT_BTC`), fullRow(`${code}_USDT_ETH`)]])),
    price: 200,
    open: 100,
    etags: Object.fromEntries(codes.map((code) => [code, `"v1-${code}"`])),
    tickers404: false,
    static404: false,
  }
  const cache = new CoinrayCache("token", {apiEndpoint: "http://test"}, 30_000, {apiCache, onStoreCache: vi.fn()})
  await vi.advanceTimersByTimeAsync(0) // let Coinray's constructor schedule its token/time-offset timers
  vi.clearAllTimers()
  const api: any = cache.getRootApi()
  api.destroy = vi.fn()
  api.subscribeTickers = vi.fn()
  api.unsubscribeTickers = vi.fn()
  api.get = vi.fn(async (endpoint: string, {params = {} as any, headers = {} as any} = {}) => {
    switch (endpoint) {
      case "exchanges":
        return {result: {exchanges: server.exchanges.map(exchangeRow)}, _headers: {}}
      case "markets":
        return {result: {markets: server.markets[params.exchange].map((m) => ({...m}))}, _headers: {}}
      case "tickers": {
        if (server.tickersGate) await server.tickersGate
        if (server.tickers404) throw notFound()
        if (server.tickersNetworkError) throw networkError()
        const tickers = Object.fromEntries(params.exchanges.split(",").filter((c) => server.markets[c])
          .map((c) => [c, server.markets[c].map((m) => compactTicker(m.coinraySymbol, server.price, server.open))]))
        return {result: {tickers}, _headers: {}}
      }
      case "markets/static": {
        if (server.static404) throw notFound()
        const etag = server.etags[params.exchange]
        if (headers["If-None-Match"] === etag) return {result: "", _headers: {}, _status: 304}
        return {result: {markets: server.markets[params.exchange].map((m) => staticRow(m.coinraySymbol, {precisionPrice: m.precisionPrice}))}, _headers: {etag}, _status: 200}
      }
    }
    throw new Error(`unexpected ${endpoint}`)
  })
  const calls = (endpoint: string) => api.get.mock.calls.filter(([e]) => e === endpoint)
  const onStoreCache = (cache as any).onStoreCache
  return {cache, api, server, calls, onStoreCache}
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe("active set", () => {
  test("pinned ∪ subscribed ∪ leased, unknown codes ignored, 2 min grace", async () => {
    const {cache} = await setup()
    await cache.initialize()

    cache.setActiveExchanges(["BINA", "NOPE"])
    const release = cache.touchExchange("KUCN_USDT_BTC")
    cache.subscribeTickers("widget", ["OKEX_USDT_BTC"])
    await vi.advanceTimersByTimeAsync(1000) // ticker subscription flush
    expect(cache.getActiveExchanges()).toEqual(["BINA", "KUCN", "OKEX"])

    release()
    release() // idempotent
    cache.unsubscribeAllTickers("widget")
    await vi.advanceTimersByTimeAsync(1000)
    expect(cache.getActiveExchanges()).toEqual(["BINA", "KUCN", "OKEX"]) // grace

    await vi.advanceTimersByTimeAsync(2 * 60 * 1000)
    expect(cache.getActiveExchanges()).toEqual(["BINA"])
    cache.destroy()
  })

  test("a lease re-taken within grace keeps the exchange without a gap", async () => {
    const {cache} = await setup()
    await cache.initialize()
    cache.touchExchange("KUCN")()
    await vi.advanceTimersByTimeAsync(60 * 1000)
    const release = cache.touchExchange("KUCN")
    await vi.advanceTimersByTimeAsync(90 * 1000)
    expect(cache.getActiveExchanges()).toEqual(["KUCN"])
    release()
    cache.destroy()
  })
})

describe("tickers loop", () => {
  test("chunks active codes by 10, sorted, and fires marketsUpdated every tick", async () => {
    const codes = Array.from({length: 23}, (_, i) => `EX${String(i).padStart(2, "0")}`)
    const {cache, calls} = await setup(codes)
    await cache.initialize()
    const events: any[] = []
    cache.on("marketsUpdated", ({data}) => events.push(data))

    await vi.advanceTimersByTimeAsync(30_000)
    expect(calls("tickers")).toHaveLength(0)
    expect(events).toEqual([{exchangeCodes: []}]) // refresh clock even with nothing active

    cache.setActiveExchanges([...codes].reverse())
    await vi.advanceTimersByTimeAsync(30_000)
    const requested = calls("tickers").slice(-3).map(([, {params}]) => params.exchanges) // after the activation fetch
    expect(requested).toEqual([codes.slice(0, 10).join(","), codes.slice(10, 20).join(","), codes.slice(20).join(",")])
    expect(events.at(-1)).toEqual({exchangeCodes: codes})
    cache.destroy()
  })

  test("applySnapshot updates markets in place; subscribed and current markets keep websocket prices", async () => {
    const {cache} = await setup()
    await cache.initialize()
    const btc = cache.getMarket("BINA_USDT_BTC")
    const eth = cache.getMarket("BINA_USDT_ETH")
    const kucn = cache.getMarket("KUCN_USDT_BTC")
    const onTicker = vi.fn()
    btc.on("ticker", onTicker)

    cache.subscribeTickers("widget", ["BINA_USDT_ETH"])
    const releaseLive = cache.retainLiveMarket("KUCN_USDT_BTC")
    await vi.advanceTimersByTimeAsync(1000) // subscription flush activates BINA
    cache.touchExchange(["BINA", "KUCN"])
    await vi.advanceTimersByTimeAsync(29_000)

    expect(cache.getMarket("BINA_USDT_BTC")).toBe(btc)
    expect(onTicker).toHaveBeenCalledTimes(2) // activation fetch + tick
    expect(btc.lastPrice.toString()).toBe("200")
    expect(btc.bidPrice.toString()).toBe("199")
    expect(btc.askPrice.toString()).toBe("201")
    expect([btc.openPrice, btc.highPrice, btc.lowPrice].map(String)).toEqual(["100", "300", "50"])
    expect([btc.volume, btc.quoteVolume, btc.btcVolume, btc.usdVolume].map(String)).toEqual(["10", "20", "30", "40"])
    expect([btc.baseToUsd, btc.quoteToUsd, btc.marketCap].map(String)).toEqual(["2", "3", "5000"])
    expect(btc.change).toBe(100)

    for (const live of [eth, kucn]) {
      expect(live.lastPrice.toString()).toBe("100")
      expect(live.highPrice.toString()).toBe("100")
      expect(live.volume.toString()).toBe("10")
      expect(live.marketCap.toString()).toBe("5000")
    }

    releaseLive()
    await vi.advanceTimersByTimeAsync(30_000)
    expect(kucn.lastPrice.toString()).toBe("200")
    cache.destroy()
  })

  test("unchanged ticker fields reuse their BigNumbers; change follows price moves", async () => {
    const {cache, server} = await setup()
    await cache.initialize()
    const btc = cache.getMarket("BINA_USDT_BTC")
    cache.touchExchange("BINA")
    await vi.advanceTimersByTimeAsync(30_000)
    const {lastPrice, volume} = btc
    expect(btc.change).toBe(100)

    await vi.advanceTimersByTimeAsync(30_000)
    expect(btc.lastPrice).toBe(lastPrice)
    expect(btc.volume).toBe(volume)
    expect(btc.change).toBe(100)

    server.price = 150
    await vi.advanceTimersByTimeAsync(30_000)
    expect(btc.lastPrice.toString()).toBe("150")
    expect(btc.volume).toBe(volume)
    expect(btc.change).toBe(50)
    cache.destroy()
  })

  test("change follows a 24h open move while the last price is unchanged", async () => {
    const {cache, server} = await setup()
    await cache.initialize()
    const btc = cache.getMarket("BINA_USDT_BTC")
    cache.touchExchange("BINA")
    await vi.advanceTimersByTimeAsync(30_000)
    const {lastPrice} = btc
    expect(btc.change).toBe(100)

    server.open = 50
    await vi.advanceTimersByTimeAsync(30_000)
    expect(btc.lastPrice).toBe(lastPrice)
    expect(btc.change).toBe(300)
    cache.destroy()
  })

  test("change is recomputed when a market returns from websocket to REST snapshots", async () => {
    const {cache} = await setup()
    await cache.initialize()
    const btc = cache.getMarket("BINA_USDT_BTC")
    cache.touchExchange("BINA")
    await vi.advanceTimersByTimeAsync(30_000)
    expect(btc.change).toBe(100)

    const releaseLive = cache.retainLiveMarket("BINA_USDT_BTC")
    btc.updateLastPrice(new BigNumber(150))
    expect(btc.change).toBe(50)

    releaseLive()
    await vi.advanceTimersByTimeAsync(30_000)
    expect(btc.lastPrice.toString()).toBe("200")
    expect(btc.change).toBe(100)
    cache.destroy()
  })

  test("404 falls back to a full /markets reload for active exchanges only", async () => {
    const {cache, server, calls} = await setup()
    await cache.initialize()
    server.tickers404 = true
    cache.setActiveExchanges(["BINA"])
    const before = calls("markets").length

    await vi.advanceTimersByTimeAsync(30_000)
    const reloaded = calls("markets").slice(before).map(([, {params}]) => params.exchange)
    expect(reloaded).toEqual(["BINA", "BINA"]) // activation fetch + tick
    cache.destroy()
  })
})

describe("missing backend routes", () => {
  test("network error falls back to /markets, logs once, and re-probes every 10 min until the route exists", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined)
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined)
    const {cache, server, calls} = await setup()
    await cache.initialize()
    server.tickersNetworkError = true
    cache.setActiveExchanges(["BINA"])
    const marketsBefore = calls("markets").length

    await vi.advanceTimersByTimeAsync(9 * 60 * 1000) // activation + 18 ticks
    expect(calls("tickers")).toHaveLength(1) // probed once, then straight to the fallback
    expect(calls("markets").length - marketsBefore).toBe(19)
    expect(warn).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(90 * 1000) // re-probe after 10 min, still missing
    expect(calls("tickers")).toHaveLength(2)
    expect(warn).toHaveBeenCalledTimes(1)

    server.tickersNetworkError = false // backend deployed
    await vi.advanceTimersByTimeAsync(10 * 60 * 1000)
    const markets = calls("markets").length
    const tickers = calls("tickers").length
    await vi.advanceTimersByTimeAsync(60 * 1000)
    expect(calls("tickers").length - tickers).toBe(2)
    expect(calls("markets").length).toBe(markets)
    expect(cache.getMarket("BINA_USDT_BTC").lastPrice.toString()).toBe("200")
    expect(error.mock.calls.filter(([e]) => e?.message === "Network Error")).toHaveLength(0)
    cache.destroy()
    warn.mockRestore()
    error.mockRestore()
  })
})

describe("activation", () => {
  test("activations within 250ms of the first are batched into one tickers fetch", async () => {
    const {cache, calls} = await setup()
    await cache.initialize()
    cache.setActiveExchanges(["OKEX"])
    await vi.advanceTimersByTimeAsync(100)
    cache.touchExchange("BINA")
    await vi.advanceTimersByTimeAsync(149)
    expect(calls("tickers")).toHaveLength(0)
    await vi.advanceTimersByTimeAsync(1)
    expect(calls("tickers").map(([, {params}]) => params.exchanges)).toEqual(["BINA,OKEX"])
    cache.destroy()
  })

  test("ensureFresh resolves after a tickers fetch for the given symbols", async () => {
    const {cache, calls} = await setup()
    await cache.initialize()
    let resolved = false
    cache.ensureFresh(["KUCN_USDT_BTC", "NOPE_USDT_BTC"]).then(() => resolved = true)
    await vi.advanceTimersByTimeAsync(0)
    expect(resolved).toBe(false)
    await vi.advanceTimersByTimeAsync(250)
    expect(resolved).toBe(true)
    expect(calls("tickers").map(([, {params}]) => params.exchanges)).toEqual(["KUCN"])
    expect(cache.getMarket("KUCN_USDT_BTC").lastPrice.toString()).toBe("200")
    cache.destroy()
  })
})

describe("static loop", () => {
  test("200 merges in place (add, remove, update), 304 is a no-op", async () => {
    const {cache, server, calls, onStoreCache} = await setup()
    await cache.initialize()
    expect(onStoreCache).toHaveBeenCalledTimes(1)
    cache.setActiveExchanges(["BINA"])
    await vi.advanceTimersByTimeAsync(300)

    const btc = cache.getMarket("BINA_USDT_BTC")
    const eth = cache.getMarket("BINA_USDT_ETH")
    const onEth = vi.fn()
    eth.on("ticker", onEth)
    server.markets.BINA = [fullRow("BINA_USDT_BTC", {precisionPrice: 5}), fullRow("BINA_USDT_SOL")]

    await vi.advanceTimersByTimeAsync(10 * 60 * 1000)
    expect(calls("markets/static").map(([, {headers}]) => headers)).toEqual([{}])
    expect(cache.getMarket("BINA_USDT_BTC")).toBe(btc)
    expect(btc.precisionPrice).toBe(5)
    expect(btc.lastPrice.toString()).toBe("200") // prices untouched by static data
    expect(cache.getMarket("BINA_USDT_ETH")).toBeUndefined()
    expect(eth.listeners).toEqual({})
    expect(cache.getExchange("BINA").getMarketByExchangeSymbol("SOLUSDT")).toBeDefined()
    expect(cache.getMarket("BINA_USDT_SOL").lastPrice.toString()).toBe("200") // new market priced by activation fetch

    expect(onStoreCache).toHaveBeenCalledTimes(2)
    const stored = onStoreCache.mock.calls[1][0]
    expect(stored.markets.BINA.map((m) => m.coinraySymbol)).toEqual(["BINA_USDT_BTC", "BINA_USDT_SOL"])
    expect(stored.markets.BINA[0]).toMatchObject({precisionPrice: 5, lastPrice: "100", updatedAt: "2026-09-29T00:00:00Z"})
    expect(stored.markets.KUCN).toHaveLength(2)
    expect(() => JSON.stringify(stored)).not.toThrow()

    await vi.advanceTimersByTimeAsync(10 * 60 * 1000)
    expect(calls("markets/static").at(-1)[1].headers).toEqual({"If-None-Match": '"v1-BINA"'})
    expect(onStoreCache).toHaveBeenCalledTimes(2)
    expect(cache.getMarket("BINA_USDT_BTC")).toBe(btc)
    cache.destroy()
  })

  test("404 falls back to a full /markets reload", async () => {
    const {cache, server, calls} = await setup()
    await cache.initialize()
    server.static404 = true
    cache.setActiveExchanges(["KUCN"])
    const before = calls("markets").length
    await vi.advanceTimersByTimeAsync(10 * 60 * 1000)
    expect(calls("markets").slice(before).map(([, {params}]) => params.exchange)).toEqual(["KUCN"])
    cache.destroy()
  })
})

describe("exchanges loop", () => {
  test("updates existing exchanges in place and fully loads new ones", async () => {
    const {cache, server, onStoreCache} = await setup(["BINA"])
    await cache.initialize()
    const bina = cache.getExchange("BINA")
    server.exchanges = ["BINA", "GATE"]
    server.markets.GATE = [fullRow("GATE_USDT_BTC")]

    await vi.advanceTimersByTimeAsync(10 * 60 * 1000)
    expect(cache.getExchange("BINA")).toBe(bina)
    expect(cache.getMarket("GATE_USDT_BTC")).toBeDefined()
    expect(onStoreCache.mock.calls.at(-1)[0].markets.GATE).toHaveLength(1)
    cache.destroy()
  })
})

describe("lifecycle", () => {
  test("loops start only after the live load that follows the snapshot", async () => {
    const snapshot = {exchanges: [exchangeRow("BINA")], markets: {BINA: [fullRow("BINA_USDT_BTC")]}}
    const {cache, api, calls} = await setup(["BINA"], {apiCache: snapshot})
    let finishLiveLoad: () => void
    const gate = new Promise<void>((resolve) => finishLiveLoad = resolve)
    const get = api.get.getMockImplementation()
    api.get.mockImplementation(async (...args) => {
      await gate
      return get(...args)
    })

    await cache.initialize()
    expect(cache.getMarket("BINA_USDT_BTC")).toBeDefined()
    expect(vi.getTimerCount()).toBe(0)

    finishLiveLoad()
    await vi.advanceTimersByTimeAsync(0)
    expect(vi.getTimerCount()).toBe(3)
    expect(calls("markets")).toHaveLength(1)
    cache.destroy()
  })

  test("destroy clears every timer and in-flight fetches do not reschedule", async () => {
    const {cache, server} = await setup()
    await cache.initialize()
    cache.setActiveExchanges(["BINA"])
    cache.subscribeTickers("widget", ["KUCN_USDT_BTC"])
    let finishTickers: () => void
    server.tickersGate = new Promise<void>((resolve) => finishTickers = resolve)

    await vi.advanceTimersByTimeAsync(250) // activation fetch now in flight
    let fresh = false
    cache.ensureFresh("OKEX").then(() => fresh = true)
    cache.destroy()
    expect(vi.getTimerCount()).toBe(0)

    finishTickers()
    await vi.advanceTimersByTimeAsync(60 * 60 * 1000)
    expect(vi.getTimerCount()).toBe(0)
    expect(fresh).toBe(true)
  })
})

describe("startup and teardown", () => {
  test("an unusable snapshot falls through to the live load", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined)
    const {cache} = await setup(["BINA"], {apiCache: {exchanges: [{code: "BROKEN"}], markets: {}}})
    await cache.initialize()
    expect(cache.getMarket("BINA_USDT_BTC")).toBeDefined()
    expect(vi.getTimerCount()).toBe(3)
    cache.destroy()
    error.mockRestore()
  })

  test("a failed live load is retried every refreshRate, then the loops start", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined)
    const {cache, api} = await setup(["BINA"])
    api.get.mockImplementationOnce(async () => { throw new Error("offline") })
    await cache.initialize()
    expect(vi.getTimerCount()).toBe(1) // only the retry

    await vi.advanceTimersByTimeAsync(30_000)
    expect(api.get).toHaveBeenCalledWith("markets", expect.anything())
    expect(cache.getMarket("BINA_USDT_BTC")).toBeDefined()
    expect(vi.getTimerCount()).toBe(3)
    cache.destroy()
    error.mockRestore()
  })

  test("nothing is scheduled or fetched after destroy", async () => {
    const {cache, api} = await setup()
    await cache.initialize()
    cache.destroy()
    const calls = api.get.mock.calls.length

    const release = cache.touchExchange("BINA")
    cache.setActiveExchanges(["KUCN"])
    await cache.ensureFresh("OKEX")
    release()
    expect(vi.getTimerCount()).toBe(0)
    await vi.advanceTimersByTimeAsync(60 * 60 * 1000)
    expect(api.get.mock.calls.length).toBe(calls)
  })
})

describe("websocket tickers", () => {
  // shape of backend common::Ticker (lib.rs:757): uppercase = 24h, lowercase = current 1s candle
  const wsTicker = {
    s: "BINA_USDT_BTC", BV: "1234.5", QV: "98765432.1", B: "1500.25", U: "98700000", O: "80000", H: "81000", L: "79000",
    bv: "0.5", qv: "40000", o: "80010", h: "80020", l: "80005", c: "80015", a: "80016", b: "80014",
    t: "2026-09-29T12:00:00.000Z",
  }

  test("parses 24h volumes from uppercase keys and 1s values from lowercase keys", () => {
    const ticker = (Coinray as any)._parseTicker(wsTicker)
    expect(ticker.baseVolume.toString()).toBe("1234.5")
    expect(ticker.quoteVolume.toString()).toBe("98765432.1")
    expect(ticker.baseVolume1s.toString()).toBe("0.5")
    expect(ticker.quoteVolume1s.toString()).toBe("40000")
    expect(ticker.openPrice24h.toString()).toBe("80000")
    expect(ticker.openPrice1s.toString()).toBe("80010")
  })

  test("updateTicker applies the 24h volumes to the market", async () => {
    const {cache} = await setup(["BINA"])
    await cache.initialize()
    cache.subscribeTickers("widget", ["BINA_USDT_BTC"])
    await vi.advanceTimersByTimeAsync(1000)

    await cache.refreshMarketsFromTickers({exchangeCode: "BINA", tickers: [(Coinray as any)._parseTicker(wsTicker)]})
    const market = cache.getMarket("BINA_USDT_BTC")
    expect([market.volume, market.quoteVolume, market.btcVolume, market.usdVolume].map(String))
      .toEqual(["1234.5", "98765432.1", "1500.25", "98700000"])
    expect([market.openPrice, market.highPrice, market.lowPrice, market.lastPrice].map(String))
      .toEqual(["80000", "81000", "79000", "80015"])
    cache.destroy()
  })
})

describe("TickerSubscriptions", () => {
  test("unsubscribeAll only drops the caller's pending additions", () => {
    const subscriptions = new TickerSubscriptions()
    subscriptions.subscribe("a", ["BINA_USDT_BTC"])
    subscriptions.subscribe("b", ["BINA_USDT_BTC", "KUCN_USDT_BTC"])
    subscriptions.unsubscribeAll("a")
    subscriptions.processPendingChanges()
    expect(subscriptions.has("BINA_USDT_BTC")).toBe(true)
    expect(subscriptions.has("KUCN_USDT_BTC")).toBe(true)
    expect([...subscriptions.exchangeCodes()].sort()).toEqual(["BINA", "KUCN"])
  })
})
