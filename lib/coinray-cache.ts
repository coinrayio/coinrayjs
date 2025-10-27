import Coinray from "./coinray";
import Exchange from "./exchange";
import {filterMarkets} from "./util";
import {CacheParams, Candle, CandleParam, CandlesParam, MarketMap, MarketParam, MarketQuery} from "./types";
import EventEmitter from "./event-emitter"
import TickerSubscriptions from "./ticker-subscriptions";

interface ExchangeMap {
  [key: string]: Exchange;
}

export default class CoinrayCache extends EventEmitter {
  private rootApi: Coinray;
  private apis: Map<string, Coinray>;
  private exchanges: ExchangeMap;
  public initialized: boolean;
  public refreshRate: number;
  private refreshTimeout: any;
  private _refreshingToken: any;
  private tickerSubscriptions: TickerSubscriptions;
  private tickerSubscriptionRefeshTimer: any;
  private _onTokenExpired: () => Promise<string>;
  private readonly onStoreCache
  private readonly apiCache

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
    if (this.refreshTimeout) {
      clearTimeout(this.refreshTimeout)
    }

    try {
      if (this.apiCache) {
        await this.refreshExchanges(this.apiCache)
        this.refreshExchanges()
      } else {
        await this.refreshExchanges()
      }
    } catch (e) {
      console.error(e)
    }

    this.refreshTimeout = setTimeout(this.refreshExchangeInterval, this.refreshRate)
  }

  refreshExchangeInterval = async () => {
    try {
      await this.refreshExchanges()
    } catch (e) {
      console.error(e)
    }
    this.refreshTimeout = setTimeout(this.refreshExchangeInterval, this.refreshRate)
  }

  destroy() {
    for (const api of this.apis.values()) {
      try {
        api.destroy()
      } catch (error) {
        console.error("Could not destroy coinray", error)
      }
    }

    if (this.refreshTimeout) {
      clearTimeout(this.refreshTimeout)
    }
    this.initialized = false;
  }

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

    newCache.markets = allMarkets.reduce((mem, val) => ({...mem, [Object.keys(val)[0]]: Object.values(val)[0]}), [])

    this.exchanges = exchanges.reduce((mem, exchange) => {
      mem[exchange.code] = exchange;
      return mem
    }, {});

    this.dispatchEvent("marketsUpdated")

    if (!apiCache && this.onStoreCache) this.onStoreCache(newCache)
  };

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

  refreshMarkets = async (exchangeCode) => {
    await this.exchanges[exchangeCode].loadMarkets();
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

  subscribeTickers(listenerId : string, coinraySymbols: string[], resetExisting = false) {
    this.tickerSubscriptions.subscribe(listenerId, coinraySymbols, resetExisting)
    this.scheduleTickerRefresh()
  }

  scheduleTickerRefresh() {
    if (this.tickerSubscriptionRefeshTimer) {
      clearTimeout(this.tickerSubscriptionRefeshTimer)
    }
    this.tickerSubscriptionRefeshTimer = setTimeout(async () => {
      await this.flushTickerSubscriptions()
      this.tickerSubscriptionRefeshTimer = null
    }, 1000)
  }

  unsubscribeAllTickers(listenerId : string) {
    this.tickerSubscriptions.unsubscribeAll(listenerId)
    this.scheduleTickerRefresh()
  }

  unsubscribeTickers(listenerId : string, coinraySymbols: string[]) {
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
        this.dispatchEvent("marketsUpdated")
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
