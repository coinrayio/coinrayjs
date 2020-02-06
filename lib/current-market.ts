import CoinrayCache from "./coinray-cache";
import {OrderBook, Trade} from "./types";
import EventEmitter from "./event-emitter";
import Coinray from "./coinray";
import _ from "lodash";

export default class CurrentMarket extends EventEmitter {
  private coinrayCache: CoinrayCache;
  public coinraySymbol: string;
  private timeouts: {};
  private api: Coinray;
  private orderBook: { asks: {}; bids: {} };
  private trades: any[];

  constructor(api: Coinray, coinrayCache: CoinrayCache) {
    super();
    this.api = api;
    this.coinrayCache = coinrayCache;
    this.timeouts = {};
    this.clear();
  }

  setCoinraySymbol(coinraySymbol: string) {
    this.dispatchEvent('coinraySymbolWillChange', {coinraySymbol});
    this.stop();

    this.coinraySymbol = coinraySymbol;

    this.startOrderBook();
    this.startTrades();
    this.dispatchEvent('coinraySymbolChanged', {coinraySymbol});
  }

  clear() {
    this.coinraySymbol = null;
    this.removeAllListeners();
    this.stop();
  }

  stop() {
    this.stopOrderBook();
    this.stopTrades();

    this.trades = [];
    this.orderBook = {
      bids: {},
      asks: {}
    };
  }

  getMarket() {
    if (this.coinraySymbol) {
      return this.coinrayCache.getMarket(this.coinraySymbol)
    } else {
      throw "CoinraySymbol not loaded"
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
    this.subscribeOrderBook(this.handleMarketUpdate);
    this.subscribeTrades(this.handleMarketUpdate);
    return callback;
  };

  handleMarketUpdate = ({data: {type, coinraySymbol, ...rest}}) => {
    if (this.coinraySymbol !== coinraySymbol) {
      this.unsubscribeOrderBook(this.handleOrderBook);
      this.unsubscribeTrades(this.handleOrderBook);
      return
    }

    switch (type) {
      case "trades:snapshot":
      case "trades:update": {
        const {trades} = rest;
        const market = this.getMarket();
        const lastPrice = trades[0].price;
        if (!market.lastPrice.eq(lastPrice)) {
          market.updateTicker({lastPrice});
          this.dispatchEvent('marketUpdated', {market})
        }
        break;
      }
      case "orderBook:snapshot":
      case "orderBook:update": {
        const {orderBook: {bids, asks}} = rest;
        const market = this.getMarket();
        const askPrice = asks[0].price;
        const bidPrice = bids[0].price;
        if (!market.askPrice.eq(askPrice) || !market.bidPrice.eq(bidPrice)) {
          market.updateTicker({askPrice, bidPrice});
          this.dispatchEvent('marketUpdated', {market})
        }
        break;
      }
    }

  };

  unsubscribeMarketUpdates = (callback) => {
    this.unsubscribeOrderBook(this.handleMarketUpdate);
    this.unsubscribeTrades(this.handleMarketUpdate);
    this.off('marketUpdated', callback)
  };

  subscribeOrderBook = (callback) => {
    this.on('orderBookUpdated', callback);
    this.startOrderBook();
    return callback;
  };

  startOrderBook = () => {
    if (this.hasListeners("orderBookUpdated")) {
      this.api.subscribeOrderBook({coinraySymbol: this.coinraySymbol}, this.handleOrderBook);
    }
  };

  stopOrderBook = () => {
    if (this.coinraySymbol) {
      this.api.unsubscribeOrderBook({coinraySymbol: this.coinraySymbol}, this.handleOrderBook);
    }
  };

  handleOrderBook = async ({type, coinraySymbol, orderBook}) => {
    if (this.coinraySymbol !== coinraySymbol) {
      this.api.unsubscribeOrderBook({coinraySymbol}, this.handleOrderBook);
      return
    }
    const {bids, asks} = orderBook;

    const update = (side, updates) => {
      updates.map(({price, quantity}) => {
        if (quantity.gt(0)) {
          side[price.toFixed(12)] = {price, quantity}
        } else {
          delete side[price.toFixed(12)]
        }
      });
    };

    if (type === "orderBook:snapshot") {
      this.orderBook.bids = _.keyBy(bids, ({price}) => price.toFixed(12));
      this.orderBook.asks = _.keyBy(asks, ({price}) => price.toFixed(12));
      this.dispatchEvent("orderBookUpdated", {type, coinraySymbol, orderBook: orderBook})
    } else {
      update(this.orderBook.bids, bids);
      update(this.orderBook.asks, asks);
      this.dispatchEvent("orderBookUpdated", {
        type, coinraySymbol, orderBook: {
          bids: Object.values(this.orderBook.bids).sort(({price: left}, {price: right}) => right.minus(left)),
          asks: Object.values(this.orderBook.asks).sort(({price: left}, {price: right}) => left.minus(right)),
        }
      })
    }
  };

  unsubscribeOrderBook = (callback) => {
    this.off('orderBookUpdated', callback)
  };

  subscribeTrades = (callback) => {
    this.on('tradesUpdated', callback);
    this.startTrades();
    return callback;
  };

  startTrades = () => {
    if (this.hasListeners("tradesUpdated")) {
      this.api.subscribeTrades({coinraySymbol: this.coinraySymbol}, this.handleTrades);
    }
  };

  stopTrades = () => {
    if (this.coinraySymbol) {
      this.api.unsubscribeTrades({coinraySymbol: this.coinraySymbol}, this.handleTrades);
    }
  };

  handleTrades = async ({type, coinraySymbol, trades}) => {
    if (this.coinraySymbol !== coinraySymbol) {
      this.api.unsubscribeTrades({coinraySymbol}, this.handleTrades);
      return
    }
    this.trades = [...trades, ...this.trades].slice(0, 100);

    this.dispatchEvent('tradesUpdated', {type, coinraySymbol, trades: this.trades})
  };

  unsubscribeTrades = (callback) => {
    this.off('tradesUpdated', callback)
  };
}
