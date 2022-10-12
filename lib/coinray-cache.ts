import Coinray from "./coinray";
import Exchange from "./exchange";
import {filterMarkets} from "./util";
import {Candle, CandleParam, CandlesParam, MarketMap, MarketParam, MarketQuery} from "./types";
import EventEmitter from "./event-emitter"

interface ExchangeMap {
  [key: string]: Exchange;
}

export default class CoinrayCache extends EventEmitter {
  private rootApi: Coinray;
  private apis: Map<string, Coinray>;
  private exchanges: ExchangeMap;
  public initialized: boolean;
  public refreshRate: number;
  private refreshInterval: any;
  private _refreshingToken: any;
  private tokenRefreshed: any;
  private _onTokenExpired: () => Promise<string>;

  constructor(token: string, config: any, refreshRate = 30 * 1000) {
    super()
    this.rootApi = new Coinray(token, config)
    this.apis = new Map()
    this.exchanges = {}
    this.initialized = false
    this.refreshRate = refreshRate

    this.rootApi.onTokenExpired(this.refreshToken)
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
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval)
    }

    await this.refreshExchanges()

    this.refreshInterval = setInterval(this.refreshExchanges, this.refreshRate)
  }

  destroy() {
    for (const api of this.apis.values()) {
      try {
        api.destroy()
      } catch (error) {
        console.error("Could not destroy coinray", error)
      }
    }

    if (this.refreshInterval) {
      clearInterval(this.refreshInterval)
    }
    this.initialized = false;
  }

  refreshExchanges = async () => {
    const exchanges = await this.rootApi.fetchExchanges((exchange) => {
      if (!this.apis.has(exchange.code)) {
        if (this.rootApi.config.apiEndpoint === exchange.apiEndpoint) {
          this.apis.set(exchange.code, this.rootApi)
        } else {
          let api = new Coinray(this.rootApi._token, exchange);
          api.onTokenExpired(this.refreshToken)
          this.apis.set(exchange.code, api)
        }
      }
      return Exchange.Create(exchange, this.apis.get(exchange.code))
    })

    await Promise.all(exchanges.map((exchange) => exchange.loadMarkets()));

    this.exchanges = exchanges.reduce((mem, exchange) => {
      mem[exchange.code] = exchange;
      return mem
    }, {});

    this.dispatchEvent("marketsUpdated")
  };

  getExchanges(): ExchangeMap {
    if (!this.initialized) {
      throw "The cache is not initialized yet"
    }
    return this.exchanges
  }

  getExchange(exchangeCode): Exchange | undefined {
    return this.getExchanges()[exchangeCode]
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
