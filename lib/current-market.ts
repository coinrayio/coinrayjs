import CoinrayCache from "./coinray-cache";
import {OrderBook, Trade} from "./types";
import EventEmitter from "./event-emitter";

let currentMarket;

export default class CurrentMarket extends EventEmitter {
  private coinrayCache: CoinrayCache;
  public coinraySymbol: string;
  public refreshRate: number;
  private loadingOrderBook: boolean;
  private loadingTrades: boolean;
  private timeouts: {};

  static instance(coinrayCache) {
    if (currentMarket) {
      return currentMarket
    } else {
      currentMarket = new CurrentMarket(coinrayCache)
    }
  }

  constructor(coinrayCache: CoinrayCache) {
    super();
    this.coinrayCache = coinrayCache;
    this.refreshRate = 15 * 1000;
    this.timeouts = {};
    this.clear();
  }

  setCoinraySymbol(coinraySymbol: string) {
    this.dispatchEvent('coinraySymbolWillChange', {coinraySymbol});
    this.coinraySymbol = coinraySymbol;

    this.broadCastMarketUpdate();
    this.broadCastOrderBook().then();
    this.broadCastTrades().then();

    this.dispatchEvent('coinraySymbolChanged', {coinraySymbol});
  }

  clear() {
    this.coinraySymbol = null;
    this.removeAllListeners()
  }

  getMarket() {
    if (this.coinraySymbol) {
      return this.coinrayCache.getMarket(this.coinraySymbol)
    } else {
      throw "CoinraySymbol not loaded"
    }
  }

  async getTrades(): Promise<{ coinraySymbol: string, trades: Trade[] }> {
    const coinraySymbol = this.coinraySymbol;
    const trades = await this.coinrayCache.getTrades(coinraySymbol);
    if (coinraySymbol === this.coinraySymbol) {
      return {coinraySymbol, trades};
    }
  }

  async getOrderBook(): Promise<{ coinraySymbol: string, orderBook: OrderBook }> {
    const coinraySymbol = this.coinraySymbol;
    const orderBook = await this.coinrayCache.getOrderBook(this.coinraySymbol);
    if (coinraySymbol === this.coinraySymbol) {
      return {coinraySymbol, orderBook};
    }
  }

  subscribeCoinraySymbolWillChange(callback) {
    return this.on('coinraySymbolWillChange', callback)
  }

  unsubscribeCoinraySymbolWillChange(callback) {
    this.off('coinraySymbolWillChange', callback)
  }

  subscribeCoinraySymbolChange(callback) {
    return this.on('coinraySymbolChanged', callback)
  }

  unsubscribeCoinraySymbolChange(callback) {
    this.off('coinraySymbolChanged', callback)
  }

  subscribeMarketUpdates = (callback) => {
    this.on("marketUpdated", callback);
    this.broadCastMarketUpdate()
    return callback;
  };

  broadCastMarketUpdate = ({lastPrice, bidPrice, askPrice}: any = {}) => {
    if (!this.coinraySymbol) {
      return
    }
    const callbacks = this.listeners['marketUpdated'];
    if (callbacks && callbacks.length > 0) {
      this.setTimeout('broadCastMarketUpdate', this.refreshRate, this.broadCastMarketUpdate);
      const market = this.getMarket();
      market.updateTicker({lastPrice, bidPrice, askPrice});
      callbacks.forEach((callback) => {
        callback(market)
      });
    }
  };

  unsubscribeMarketUpdates = (callback) => {
    this.off('marketUpdated', callback)
  };

  subscribeOrderBook = (callback) => {
    this.on('orderBookUpdated', callback);
    this.broadCastOrderBook();
    return callback;
  };

  broadCastOrderBook = async () => {
    if (this.loadingOrderBook || !this.coinraySymbol) {
      return
    }

    const callbacks = this.listeners['orderBookUpdated'];
    if (callbacks && callbacks.length > 0) {
      try {
        this.loadingOrderBook = true;
        this.setTimeout('broadCastOrderBook', this.refreshRate, this.broadCastOrderBook);
        const orderBook = await this.getOrderBook();

        if (orderBook) {
          callbacks.forEach((callback) => {
            callback(orderBook)
          });
        }

        const lastAsk = orderBook.orderBook.asks[0];
        const lastBid = orderBook.orderBook.bids[0];
        if (lastAsk && lastBid) {
          this.broadCastMarketUpdate({
            askPrice: lastAsk.price,
            bidPrice: lastBid.price
          });
        }
      } finally {
        this.setTimeout('broadCastOrderBook', this.refreshRate, this.broadCastOrderBook);
        this.loadingOrderBook = false
      }
    }
  };

  unsubscribeOrderBook = (callback) => {
    this.off('orderBookUpdated', callback)
  };

  subscribeTrades = (callback) => {
    this.on('tradesUpdated', callback);
    this.broadCastTrades();
    return callback;
  };

  broadCastTrades = async () => {
    if (this.loadingTrades || !this.coinraySymbol) {
      return
    }

    const callbacks = this.listeners['tradesUpdated'];
    if (callbacks && callbacks.length > 0) {
      try {
        this.loadingTrades = true;
        this.setTimeout('broadCastTrades', this.refreshRate, this.broadCastTrades);
        const trades = await this.getTrades();
        if (trades) {
          callbacks.forEach((callback) => {
            callback(trades)
          });
          const lastTrade = trades.trades[0];
          if (lastTrade) {
            this.broadCastMarketUpdate({
              lastPrice: lastTrade.price,
            });
          }
        }
      } finally {
        this.loadingTrades = false;
        this.setTimeout('broadCastTrades', this.refreshRate, this.broadCastTrades);
      }
    }
  };

  unsubscribeTrades = (callback) => {
    this.off('tradesUpdated', callback)
  };

  setTimeout(type, time, callback) {
    this.clearTimeout(type);
    this.timeouts[type] = setTimeout(callback, time)
  }

  clearTimeout(type) {
    if (this.timeouts[type]) {
      clearTimeout(this.timeouts[type])
    }
  }
}
