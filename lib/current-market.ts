import CoinrayCache from "./coinray-cache";
import {OrderBook, Trade} from "./types";

let currentMarket;

export default class CurrentMarket {
  private coinrayCache: CoinrayCache;
  public coinraySymbol: string;
  private listeners: {};
  public refreshRate: number;
  private loadingOrderBook: boolean;
  private loadingTrades: boolean;

  static instance(coinrayCache) {
    if (currentMarket) {
      return currentMarket
    } else {
      currentMarket = new CurrentMarket(coinrayCache)
    }
  }

  constructor(coinrayCache: CoinrayCache) {
    this.coinrayCache = coinrayCache;
    this.refreshRate = 15 * 1000;
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
    this.listeners = {};
  }

  getMarket() {
    return this.coinrayCache.getMarket(this.coinraySymbol)
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
    this.on('coinraySymbolWillChange', callback)
  }

  unsubscribeCoinraySymbolWillChange(callback) {
    this.off('coinraySymbolWillChange', callback)
  }

  subscribeCoinraySymbolChange(callback) {
    this.on('coinraySymbolChanged', callback)
  }

  unsubscribeCoinraySymbolChange(callback) {
    this.off('coinraySymbolChanged', callback)
  }

  subscribeMarketUpdates = (callback) => {
    this.on("marketUpdated", callback);
    this.broadCastMarketUpdate()
  };

  broadCastMarketUpdate = ({lastPrice, bidPrice, askPrice}: any = {}) => {
    const callbacks = this.listeners['marketUpdated'];
    if (callbacks && callbacks.length > 0) {
      const market = this.getMarket();
      market.updateTicker({lastPrice, bidPrice, askPrice});
      callbacks.forEach((callback) => {
        callback(market)
      });

      setTimeout(this.broadCastMarketUpdate, this.refreshRate)
    }
  };

  unsubscribeMarketUpdates = (callback) => {
    this.off('marketUpdated', callback)
  };

  subscribeOrderBook = (callback) => {
    this.on('orderBookUpdated', callback);
    this.broadCastOrderBook()
  };

  broadCastOrderBook = async () => {
    if (this.loadingOrderBook) {
      return
    }

    const callbacks = this.listeners['orderBookUpdated'];
    if (callbacks && callbacks.length > 0) {
      try {
        this.loadingOrderBook = true;
        const orderBook = await this.getOrderBook();

        if (orderBook) {
          callbacks.forEach((callback) => {
            callback(orderBook)
          });
          setTimeout(this.broadCastOrderBook, this.refreshRate)
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
        this.loadingOrderBook = false
      }
    }
  };

  unsubscribeOrderBook = (callback) => {
    this.off('orderBookUpdated', callback)
  };

  subscribeTrades = (callback) => {
    this.on('tradesUpdated', callback);
    this.broadCastTrades()
  };

  broadCastTrades = async () => {
    if (this.loadingTrades) {
      return
    }

    const callbacks = this.listeners['tradesUpdated'];
    if (callbacks && callbacks.length > 0) {
      try {
        this.loadingTrades = true;
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
          setTimeout(this.broadCastTrades, this.refreshRate)
        }
      } finally {
        this.loadingTrades = false;
      }
    }
  };

  unsubscribeTrades = (callback) => {
    this.off('tradesUpdated', callback)
  };

  on = (type, callback) => {
    if (!(type in this.listeners)) {
      this.listeners[type] = []
    }
    this.listeners[type].push(callback);
    return callback
  };

  off = (type, callback) => {
    if (!(type in this.listeners)) {
      return;
    }
    if (callback) {
      this.listeners[type] = this.listeners[type].filter((c) => c !== callback)
    } else {
      this.listeners[type] = []
    }
  };

  dispatchEvent = (type, data) => {
    const callbacks = this.listeners[type];
    if (callbacks && callbacks.length > 0) {
      callbacks.map((callback) => callback(data))
    }
  }
}
