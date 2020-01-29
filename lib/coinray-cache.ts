import Coinray from "./coinray";
import Exchange from "./exchange";
import CandlesCache from "./candles-cache";
import {filterMarket} from "./util";
import {MarketMap} from "./types";
import EventEmitter from "./event-emitter"

interface ExchangeMap {
  [key: string]: Exchange;
}

export default class CoinrayCache extends EventEmitter {
  private api: Coinray;
  private exchanges: ExchangeMap;
  public initialized: boolean;
  private candlesCache: CandlesCache;
  public refreshRate: number;
  private refreshInterval: any;

  constructor(api: Coinray, refreshRate = 30 * 1000) {
    super();
    this.api = api;
    this.exchanges = {};
    this.initialized = false;
    this.refreshRate = refreshRate;
    this.candlesCache = new CandlesCache(30, api)
  }

  async initialize() {
    await this.refreshExchanges();
    this.initialized = true;

    this.refreshInterval = setInterval(this.refreshExchanges, this.refreshRate)
  }

  destroy() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval)
    }
    this.initialized = false;
  }

  refreshExchanges = async () => {
    const exchanges = await this.api.fetchExchanges();
    await Promise.all(exchanges.map((exchange) => exchange.loadMarkets()));

    this.exchanges = exchanges.reduce((mem, exchange) => {
      mem[exchange.code] = exchange;
      return mem
    }, {});

    this.dispatchEvent("marketsUpdated")
  };

  getExchanges() {
    if (!this.initialized) {
      throw "The cache is not initialized yet"
    }
    return this.exchanges
  }

  getExchange(exchangeCode) {
    return this.getExchanges()[exchangeCode]
  }

  refreshMarkets = async (exchangeCode) => {
    await this.exchanges[exchangeCode].loadMarkets();
  };

  searchMarkets(query: string): MarketMap {
    return Object.values(this.exchanges).reduce((acc, exchange) => {
      acc = {...acc, ...filterMarket(exchange.markets, query)};
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
    const exchange = this.getExchange(coinraySymbol.split("_")[0]);
    if (exchange) {
      return exchange.getMarket(coinraySymbol)
    }
  };

  getCandles = async (coinraySymbol: string, startTime: number, endTime: number, resolution: string) => {
    return await this.candlesCache.load(coinraySymbol, startTime, endTime, resolution)
  };

  getTrades = async (coinraySymbol: string) => {
    return await this.api.fetchTrades(coinraySymbol)
  };

  getOrderBook = async (coinraySymbol: string) => {
    return await this.api.fetchOrderBook(coinraySymbol)
  };
}
