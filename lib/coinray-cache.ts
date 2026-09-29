import Coinray from "./coinray";
import Exchange from "./exchange";
import {filterMarkets} from "./util";
import {CacheParams, Candle, CandleParam, CandlesParam, MarketMap, MarketParam, MarketQuery} from "./types";
import EventEmitter from "./event-emitter"
import TickerSubscriptions from "./ticker-subscriptions";
import _ from "lodash";

interface ExchangeMap {
  [key: string]: Exchange;
}

const GRACE_MS = 2 * 60 * 1000
const STATIC_REFRESH_MS = 10 * 60 * 1000
const EXCHANGES_REFRESH_MS = 10 * 60 * 1000
const ENDPOINT_REPROBE_MS = 10 * 60 * 1000
const ACTIVATION_DEBOUNCE_MS = 250
const TICKERS_CHUNK_SIZE = 10

// "BINA_USDT_BTC" and "BINA" both map to "BINA"
const toExchangeCodes = (symbolsOrCodes: string | string[]): string[] =>
  _.uniq((Array.isArray(symbolsOrCodes) ? symbolsOrCodes : [symbolsOrCodes]).map((s) => `${s}`.split("_")[0]))

export default class CoinrayCache extends EventEmitter {
  private rootApi: Coinray;
  private apis: Map<string, Coinray>;
  private exchanges: ExchangeMap;
  public initialized: boolean;
  public refreshRate: number;
  private _refreshingToken: any;
  private tickerSubscriptions: TickerSubscriptions;
  private tickerSubscriptionRefeshTimer: any;
  private _onTokenExpired: () => Promise<string>;
  private readonly onStoreCache
  private apiCache
  // Raw API payloads of the last load, patched by static merges; what onStoreCache receives.
  private rawCache: { exchanges: object[], markets: { [code: string]: any[] } } = {exchanges: [], markets: {}}

  private destroyed = false
  private loopsStarted = false
  private tickersTimer: any
  private staticTimer: any
  private exchangesTimer: any
  private liveLoadTimer: any
  private activationTimer: any
  private activationPromise: Promise<void> | null = null
  private activationResolve: () => void

  // active = pinned ∪ subscribed ∪ leased, plus a grace period after dropping out
  private pinned = new Set<string>()
  private leases = new Map<string, number>()
  private graceUntil = new Map<string, number>()
  private active = new Set<string>()
  private pendingActivation = new Set<string>()
  private liveMarkets = new Map<string, number>()
  private staticEtags = new Map<string, string>()
  private staticCheckedAt = new Map<string, number>()
  // Until when /tickers or /markets/static is treated as missing (falls back to /markets), 0 = available
  private endpointDownUntil = {tickers: 0, static: 0}

  constructor(token: string, config: any, refreshRate = 30 * 1000, cachePrams: CacheParams = undefined) {
    super()
    this.rootApi = new Coinray(token, config)
    this.apis = new Map()
    this.exchanges = {}
    this.initialized = false
    this.refreshRate = refreshRate
    this.tickerSubscriptions = new TickerSubscriptions()
    this.tickerSubscriptionRefeshTimer = null

    this.rootApi.onTokenExpired(this.refreshToken)

    this.onStoreCache = cachePrams?.onStoreCache
    this.apiCache = cachePrams?.apiCache
  }

  async initialize() {
    if (this.initialized) {
      return
    }
    await this.start()

    this.initialized = true;
  }

  getRootApi(): Coinray {
    return this.rootApi
  }

  authenticateDevice(credential: string, sessionKey: string) {
    this.rootApi.authenticateDevice(credential, sessionKey)
  }

  refreshToken = async () => {
    if (!this._onTokenExpired) {
      return
    }

    if (this._refreshingToken) {
      return await this._refreshingToken
    } else {
      this._refreshingToken = this._onTokenExpired()
      let token = await this._refreshingToken
      this._refreshingToken = undefined
      for (const api of this.apis.values()) {
        api.refreshToken(token)
      }
      return token
    }
  }

  onTokenExpired(callback: () => Promise<string>) {
    this._onTokenExpired = callback
  }

  async start() {
    if (this.apiCache) {
      try {
        await this.refreshExchanges(this.apiCache)
        this.liveLoad() // not awaited: initialize() resolves on the snapshot, as before
        return
      } catch (e) {
        console.error(e) // unusable snapshot: fall through to a live load
      } finally {
        this.apiCache = undefined // ponytail: rawCache holds the live copy from here on
      }
    }
    await this.liveLoad()
  }

  // Full live load; retried every refreshRate until it succeeds (as the old 30s full refresh did), then the loops start.
  private liveLoad = async () => {
    try {
      await this.refreshExchanges()
      this.startLoops()
    } catch (e) {
      console.error(e)
      if (!this.destroyed) this.liveLoadTimer = setTimeout(this.liveLoad, this.refreshRate)
    }
  }

  private startLoops() {
    if (this.destroyed || this.loopsStarted) return
    this.recomputeActive() // seed without activation fetches: the live load is fresh
    this.loopsStarted = true
    const now = Date.now()
    for (const code of Object.keys(this.exchanges)) this.staticCheckedAt.set(code, now)
    this.loop("tickersTimer", this.tickersTick, this.refreshRate)
    this.loop("staticTimer", this.staticTick, STATIC_REFRESH_MS)
    this.loop("exchangesTimer", this.refreshExchangeList, EXCHANGES_REFRESH_MS)
  }

  private loop(timer: "tickersTimer" | "staticTimer" | "exchangesTimer", fn: () => Promise<any>, interval: number) {
    if (this.destroyed) return
    this[timer] = setTimeout(async () => {
      try {
        await fn()
      } catch (e) {
        console.error(e)
      }
      this.loop(timer, fn, interval)
    }, interval)
  }

  destroy() {
    this.destroyed = true
    for (const api of this.apis.values()) {
      try {
        api.destroy()
      } catch (error) {
        console.error("Could not destroy coinray", error)
      }
    }

    for (const timer of [this.tickersTimer, this.staticTimer, this.exchangesTimer, this.liveLoadTimer, this.activationTimer, this.tickerSubscriptionRefeshTimer]) {
      clearTimeout(timer)
    }
    this.activationResolve?.() // don't leave ensureFresh() callers hanging
    this.initialized = false;
  }

  // Full load: /exchanges + /markets per exchange, recreating every Exchange and Market. Startup only.
  refreshExchanges = async (apiCache = undefined) => {
    const newCache = {exchanges: [], markets: {}}

    const exchanges = await this.rootApi.fetchExchanges((exchange) => {
      newCache.exchanges.push(exchange)
      if (!this.apis.has(exchange.code)) {
        this.apis.set(exchange.code, this.rootApi)
      }
      return Exchange.Create(exchange, this.apis.get(exchange.code))
    }, apiCache?.exchanges)

    const allMarkets = await Promise.all(exchanges.map(async (exchange) => ({
      [exchange.code]: await exchange.loadMarkets(apiCache?.markets?.[exchange.code])
    })));
    if (this.destroyed) return

    newCache.markets = allMarkets.reduce((mem, val) => ({...mem, ...val}), {})

    this.exchanges = exchanges.reduce((mem, exchange) => {
      mem[exchange.code] = exchange;
      return mem
    }, {});
    this.rawCache = newCache

    this.dispatchEvent("marketsUpdated", {exchangeCodes: Object.keys(this.exchanges)})

    if (!apiCache) this.storeCache()
  };

  private storeCache() {
    if (this.onStoreCache) this.onStoreCache(this.rawCache)
  }

  // Pinned exchanges (desktop-driven); replaces the previous set. Symbols are accepted too.
  setActiveExchanges(exchangeCodes: string[]): void {
    this.pinned = new Set(toExchangeCodes(exchangeCodes))
    this.recomputeActive()
  }

  // Keeps the exchanges active while held. The returned release function is idempotent.
  touchExchange(exchangeCodes: string | string[]): () => void {
    const codes = toExchangeCodes(exchangeCodes)
    for (const code of codes) this.leases.set(code, (this.leases.get(code) || 0) + 1)
    this.recomputeActive()

    let released = false
    return () => {
      if (released) return
      released = true
      for (const code of codes) {
        const count = (this.leases.get(code) || 0) - 1
        if (count > 0) this.leases.set(code, count)
        else this.leases.delete(code)
      }
      this.recomputeActive()
    }
  }

  // Resolves after one tickers fetch for these exchanges (symbols or codes).
  async ensureFresh(symbolsOrCodes: string | string[]): Promise<void> {
    const codes = toExchangeCodes(symbolsOrCodes).filter((code) => this.exchanges[code])
    if (codes.length === 0) return
    const release = this.touchExchange(codes)
    try {
      await this.scheduleActivation(codes)
    } finally {
      release() // the grace period keeps them live for a while
    }
  }

  getActiveExchanges(): string[] {
    return [...this.recomputeActive()].sort()
  }

  // Marks a market as fed by the websocket (CurrentMarket), so REST snapshots leave its prices alone.
  retainLiveMarket(coinraySymbol: string): () => void {
    this.liveMarkets.set(coinraySymbol, (this.liveMarkets.get(coinraySymbol) || 0) + 1)
    let released = false
    return () => {
      if (released) return
      released = true
      const count = (this.liveMarkets.get(coinraySymbol) || 0) - 1
      if (count > 0) this.liveMarkets.set(coinraySymbol, count)
      else this.liveMarkets.delete(coinraySymbol)
    }
  }

  private isLive(coinraySymbol: string) {
    return this.tickerSubscriptions.has(coinraySymbol) || this.liveMarkets.has(coinraySymbol)
  }

  // ponytail: grace expiry is checked lazily (on every change and every tick), so an exchange drops out
  // up to one tick after its 2 min are up; no per-exchange timers.
  private recomputeActive(): Set<string> {
    const now = Date.now()
    const wanted = new Set<string>([...this.pinned, ...this.leases.keys(), ...this.tickerSubscriptions.exchangeCodes()])
    for (const code of wanted) this.graceUntil.delete(code)
    for (const code of this.active) {
      if (!wanted.has(code) && !this.graceUntil.has(code)) this.graceUntil.set(code, now + GRACE_MS)
    }
    for (const [code, until] of this.graceUntil) {
      if (until <= now) this.graceUntil.delete(code)
      else wanted.add(code)
    }

    // unknown codes are ignored: getExchange() fabricates placeholders for them
    const next = new Set([...wanted].filter((code) => this.exchanges[code]))
    if (this.loopsStarted) {
      const activated = [...next].filter((code) => !this.active.has(code))
      if (activated.length) this.scheduleActivation(activated)
    }
    this.active = next
    return next
  }

  // Batches activations into one tickers fetch after 250ms.
  private scheduleActivation(codes: string[]): Promise<void> {
    if (this.destroyed) return Promise.resolve()
    for (const code of codes) this.pendingActivation.add(code)
    if (!this.activationPromise) {
      this.activationPromise = new Promise((resolve) => {
        this.activationResolve = resolve
        this.activationTimer = setTimeout(async () => {
          const batch = [...this.pendingActivation]
          this.pendingActivation.clear()
          this.activationPromise = null
          try {
            await this.fetchTickers(batch)
            const now = Date.now()
            const stale = batch.filter((code) => now - (this.staticCheckedAt.get(code) || 0) >= STATIC_REFRESH_MS)
            Promise.all(stale.map(this.revalidateStatic)).then((changed) => changed.some(Boolean) && this.storeCache())
            if (!this.destroyed) this.dispatchEvent("marketsUpdated", {exchangeCodes: batch})
          } catch (e) {
            console.error(e)
          }
          resolve()
        }, ACTIVATION_DEBOUNCE_MS)
      })
    }
    return this.activationPromise
  }

  private tickersTick = async () => {
    const codes = [...this.recomputeActive()].sort()
    await this.fetchTickers(codes)
    // fires even with nothing active: consumers use it as their refresh clock
    if (!this.destroyed) this.dispatchEvent("marketsUpdated", {exchangeCodes: codes})
  }

  private staticTick = async () => {
    const changed = await Promise.all([...this.recomputeActive()].map(this.revalidateStatic))
    if (changed.some(Boolean)) this.storeCache()
  }

  private fetchTickers = async (codes: string[]) => {
    if (this.destroyed) return
    await Promise.all(_.chunk([...codes].sort(), TICKERS_CHUNK_SIZE).map(async (chunk) => {
      if (Date.now() < this.endpointDownUntil.tickers) {
        return Promise.all(chunk.map(this.refreshMarkets))
      }
      try {
        const tickers = await this.rootApi.fetchTickers(chunk)
        this.endpointDownUntil.tickers = 0
        if (this.destroyed) return
        for (const [code, list] of Object.entries(tickers)) {
          const exchange = this.exchanges[code]
          if (!exchange) continue
          for (const ticker of list) {
            exchange.markets[ticker.coinraySymbol]?.applySnapshot(ticker, this.isLive(ticker.coinraySymbol))
          }
        }
      } catch (e) {
        if (this.markEndpointDown("tickers", e)) {
          await Promise.all(chunk.map(this.refreshMarkets))
        } else {
          console.error(e)
        }
      }
    }))
  }

  // Revalidates one exchange's static market data. Resolves true when markets were merged.
  private revalidateStatic = async (code: string): Promise<boolean> => {
    const exchange = this.exchanges[code]
    if (!exchange || this.destroyed) return false
    if (Date.now() < this.endpointDownUntil.static) {
      await this.refreshMarkets(code)
      return true
    }
    try {
      const {markets, etag} = await this.rootApi.fetchStaticMarkets(code, this.staticEtags.get(code))
      this.endpointDownUntil.static = 0
      this.staticCheckedAt.set(code, Date.now())
      if (this.destroyed || !markets) return false
      if (etag) this.staticEtags.set(code, etag)

      // Static rows lack prices/volumes: overlay them on the stored raw rows so the snapshot stays complete.
      const previous = _.keyBy(this.rawCache.markets[code] || [], "coinraySymbol")
      const rows = markets.map((d: any) => ({...previous[d.coinraySymbol], ...d}))
      const {added} = exchange.mergeStatic(rows)
      if (rows.length) this.rawCache.markets[code] = rows
      if (added.length) this.scheduleActivation([code]) // new markets have no prices yet
      this.dispatchEvent("marketsUpdated", {exchangeCodes: [code]})
      return true
    } catch (e) {
      if (this.markEndpointDown("static", e)) {
        await this.refreshMarkets(code)
        return true
      }
      console.error(e)
      return false
    }
  }

  // Backend without the route yet: 404, or no response at all (the CORS preflight fails on an unknown route).
  // Falls back to /markets and re-probes after 10 min; logs once per outage.
  private markEndpointDown(endpoint: "tickers" | "static", e: any): boolean {
    if (!(e?.status === 404 || (e?.isAxiosError && !e.response))) return false
    if (!this.endpointDownUntil[endpoint]) {
      console.warn(`CoinrayCache: ${endpoint} endpoint unavailable (${e?.message}), falling back to /markets`)
    }
    this.endpointDownUntil[endpoint] = Date.now() + ENDPOINT_REPROBE_MS
    return true
  }

  // /exchanges: existing exchanges updated in place, new ones get one full /markets load.
  private refreshExchangeList = async () => {
    const list: any[] = await this.rootApi.fetchExchanges((d) => d, undefined)
    if (this.destroyed) return

    const next: ExchangeMap = {}
    const added: string[] = []
    for (const d of list) {
      if (!this.apis.has(d.code)) this.apis.set(d.code, this.rootApi)
      const existing = this.exchanges[d.code]
      try {
        if (existing) {
          existing.update(d)
          next[d.code] = existing
        } else {
          next[d.code] = Exchange.Create(d, this.apis.get(d.code))
          added.push(d.code)
        }
      } catch (e) {
        console.error(e)
        if (existing) next[d.code] = existing
      }
    }
    const removed = Object.keys(this.exchanges).filter((code) => !next[code])
    this.exchanges = next
    this.rawCache.exchanges = list
    for (const code of removed) delete this.rawCache.markets[code]

    await Promise.all(added.map(this.refreshMarkets))
    if (added.length || removed.length) {
      this.dispatchEvent("marketsUpdated", {exchangeCodes: added})
      this.storeCache()
    }
  }

  getProxyList = async (params = {}) => {
    return await this.rootApi.getProxyList(params)
  }

  getExchanges(): ExchangeMap {
    if (!this.initialized) {
      throw "The cache is not initialized yet"
    }
    return this.exchanges
  }

  getExchange(exchangeCode): Exchange | undefined {
    return this.getExchanges()[exchangeCode] || Exchange.Create({
      id: -1,
      name: exchangeCode,
      code: exchangeCode,
      websocket: false,
      active: false,
      tradingEnabled: false,
      tradingEnabledFrom: "",
      isFutures: false,
      isDex: false,
      logo: "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==\n",
      btcVolume: "0",
      usdVolume: "0",
      totalMarkets: 0,
      quoteCurrencies: [],
    }, this.rootApi)
  }

  // Full /markets reload for one exchange (recreates its Market objects).
  refreshMarkets = async (exchangeCode: string) => {
    const exchange = this.exchanges[exchangeCode]
    if (!exchange || this.destroyed) return
    try {
      const markets = await exchange.loadMarkets()
      if (markets.length) this.rawCache.markets[exchangeCode] = markets
      this.staticCheckedAt.set(exchangeCode, Date.now())
    } catch (e) {
      console.error(e)
    }
  };

  searchMarkets(marketQuery: string | MarketQuery | MarketQuery[]): MarketMap {
    return Object.values(this.exchanges).reduce((acc, exchange) => {
      acc = {...acc, ...filterMarkets(exchange.markets, marketQuery)};
      return acc
    }, {});
  }

  getMarkets(codeOrSymbols: string | string[]): MarketMap {
    switch (typeof (codeOrSymbols)) {
      case "string": {
        return this.getExchange(codeOrSymbols).markets
      }
      default: {
        return codeOrSymbols.reduce((acc, coinraySymbol) => {
          const market = this.getMarket(coinraySymbol);
          if (market) {
            acc[coinraySymbol] = market;
          }
          return acc
        }, {})
      }
    }
  }

  getMarket = (coinraySymbol: string) => {
    const parts = `${coinraySymbol}`.split("_")
    if (parts.length < 3) {
      return
    }
    const exchange = this.getExchange(parts[0]);
    if (exchange) {
      return exchange.getMarket(coinraySymbol)
    }
  };

  async fetchCandles({coinraySymbol, resolution, start, end, useWebSocket}: CandlesParam): Promise<Candle[]> {
    const api = this.apiForSymbol(coinraySymbol)
    return api.fetchCandles({coinraySymbol, resolution, start, end, useWebSocket})
  }

  async fetchFirstCandleTime({coinraySymbol, resolution}: CandlesParam): Promise<Date> {
    const api = this.apiForSymbol(coinraySymbol)
    return api.fetchFirstCandleTime({coinraySymbol, resolution})
  }

  subscribeTickers(listenerId: string, coinraySymbols: string[], resetExisting = false) {
    this.tickerSubscriptions.subscribe(listenerId, coinraySymbols, resetExisting)
    this.scheduleTickerRefresh()
  }

  scheduleTickerRefresh() {
    if (this.destroyed) return
    if (this.tickerSubscriptionRefeshTimer) {
      clearTimeout(this.tickerSubscriptionRefeshTimer)
    }
    this.tickerSubscriptionRefeshTimer = setTimeout(async () => {
      await this.flushTickerSubscriptions()
      this.tickerSubscriptionRefeshTimer = null
    }, 1000)
  }

  unsubscribeAllTickers(listenerId: string) {
    this.tickerSubscriptions.unsubscribeAll(listenerId)
    this.scheduleTickerRefresh()
  }

  unsubscribeTickers(listenerId: string, coinraySymbols: string[]) {
    this.tickerSubscriptions.unsubscribe(listenerId, coinraySymbols)
    this.scheduleTickerRefresh()
  }

  async flushTickerSubscriptions() {
    // Determine which tickers to (un)subscribe at the transport level based on listener deltas
    const toSubscribe: string[] = []
    const toUnsubscribe: string[] = []

    // Anything present in pendingAdditions should be (idempotently) subscribed
    for (const ticker of this.tickerSubscriptions.pendingAdditions.keys()) {
      toSubscribe.push(ticker)
    }

    // For removals, only unsubscribe if no listeners remain after applying pending removals & additions
    for (const [ticker, removeSet] of this.tickerSubscriptions.pendingRemovals.entries()) {
      const current = new Set<string>(this.tickerSubscriptions.subscriptions.get(ticker) || [])
      // Apply removals
      for (const id of removeSet) current.delete(id)
      // Apply any pending additions for same ticker
      const addSet = this.tickerSubscriptions.pendingAdditions.get(ticker)
      if (addSet) {
        for (const id of addSet) current.add(id)
      }
      if (current.size === 0) {
        toUnsubscribe.push(ticker)
      }
    }

    if (toSubscribe.length) {
      await this.rootApi.subscribeTickers(toSubscribe, false, this.refreshMarketsFromTickers)
    }
    if (toUnsubscribe.length) {
      this.rootApi.unsubscribeTickers(toUnsubscribe, this.refreshMarketsFromTickers)
    }

    this.tickerSubscriptions.processPendingChanges()
    this.recomputeActive()
  }

  refreshMarketsFromTickers = async (payload: any) => {
    const {exchangeCode, tickers} = payload
    const exchange = this.getExchange(exchangeCode)
    if (exchange) {
      let shouldDispatch = false
      for (const ticker of tickers) {
        if (this.tickerSubscriptions.has(ticker.coinraySymbol)) {
          const market = exchange.getMarket(ticker.coinraySymbol)
          if (market) {
            market.updateTicker(ticker)
            shouldDispatch = true
          }
        }
      }
      if (shouldDispatch) {
        this.dispatchEvent("tickersUpdated", {exchangeCode, coinraySymbols: tickers.map((t) => t.coinraySymbol)})
      }
    }
  }

  async subscribeCandles({
                           coinraySymbol,
                           resolution,
                           lastCandle
                         }: CandleParam, callback: (payload: any) => void): Promise<(payload: any) => void> {
    const api = this.apiForSymbol(coinraySymbol)
    return api.subscribeCandles({coinraySymbol, resolution, lastCandle}, callback)
  }

  async unsubscribeCandles({coinraySymbol, resolution}: CandleParam, callback?: (payload: any) => void) {
    const api = this.apiForSymbol(coinraySymbol)
    await api.unsubscribeCandles({coinraySymbol, resolution}, callback)
  }

  async subscribeOrderBook({coinraySymbol}: MarketParam, callback: (payload: any) => void) {
    const api = this.apiForSymbol(coinraySymbol)
    await api.subscribeOrderBook({coinraySymbol}, callback)
  }

  async unsubscribeOrderBook({coinraySymbol}: MarketParam, callback?: (payload: any) => void) {
    const api = this.apiForSymbol(coinraySymbol)
    await api.unsubscribeOrderBook({coinraySymbol}, callback)
  }

  async subscribeTrades({coinraySymbol}: MarketParam, callback: (payload: any) => void) {
    const api = this.apiForSymbol(coinraySymbol)
    await api.subscribeTrades({coinraySymbol}, callback)
  }

  async unsubscribeTrades({coinraySymbol}: MarketParam, callback?: (payload: any) => void) {
    const api = this.apiForSymbol(coinraySymbol)
    await api.unsubscribeTrades({coinraySymbol}, callback)
  }

  apiForSymbol(coinraySymbol: string): Coinray | undefined {
    const parts = `${coinraySymbol}`.split("_")
    if (parts.length < 3) {
      return
    }
    const exchange_code = parts[0]
    return this.apis.get(exchange_code)
  }
}
