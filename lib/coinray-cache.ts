import Coinray from "./coinray";
import Exchange from "./exchange";
import CandlesCache from "./candles-cache";
import coinray from "./coinray";

interface ExchangeMap {
  [key: string]: Exchange;
}

export default class CoinrayCache {
  private api: Coinray;
  private exchanges: ExchangeMap;
  public initialized: boolean;
  private candlesCache: CandlesCache;
  public refreshRate: number;
  private refreshInterval: any;

  constructor(api: Coinray, refreshRate = 30 * 1000) {
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
    const loading = exchanges.map(async (exchange) => await exchange.loadMarkets());

    exchanges.reduce((mem, exchange) => {
      mem[exchange.code] = exchange;
      return mem
    }, this.exchanges);

    await Promise.all(loading);
  };

  refreshMarkets = async (exchangeCode) => {
    await this.exchanges[exchangeCode].loadMarkets();
  };

  getMarkets(codeOrSymbols: string | string[]) {
    if (!this.initialized) {
      throw "The cache is not initialized yet"
    }
    switch (typeof (codeOrSymbols)) {
      case "string": {
        return this.exchanges[codeOrSymbols]
      }
      default: {
        return codeOrSymbols.map(this.getMarket)
      }
    }
  }

  getExchanges() {
    if (!this.initialized) {
      throw "The cache is not initialized yet"
    }
    return this.exchanges
  }

  getMarket = (coinraySymbol: string) => {
    if (!this.initialized) {
      throw "The cache is not initialized yet"
    }
    const exchangeCode = coinraySymbol.split("_")[0];
    return this.exchanges[exchangeCode].getMarket(coinraySymbol)
  };

  getCandles = async (coinraySymbol: string, startTime: number, endTime: number, resolution: string) => {
    await this.candlesCache.load(coinraySymbol, startTime, endTime, resolution)
  };

  getTrades = async (coinraySymbol: string) => {
    return await this.api.fetchTrades(coinraySymbol)
  };

  getOrderBook = async (coinraySymbol: string) => {
    return await this.api.fetchOrderBook(coinraySymbol)
  };
}
