import CoinrayCache from "./coinray-cache";
import EventEmitter from "./event-emitter";
import Coinray from "./coinray";
import _ from "lodash";
import {OrderBookSide} from "./types";
import BigNumber from "bignumber.js";
import {MarketNotFoundError} from "./errors";

export const TRADES_DELAY_THRESHOLD = 30 * 1000

export default class CurrentMarket extends EventEmitter {
  private coinrayCache: CoinrayCache;
  public coinraySymbol: string;
  private timeouts: {};
  private api: Coinray;
  private orderBook: { minSeq: undefined | number, maxSeq: undefined | number, asks: {}; bids: {} };
  private trades: any[];
  private tradesStarted: boolean;
  private orderBookStarted: boolean;
  private tradesDelayed: boolean;
  private maxTrades: number;

  constructor(api: Coinray, coinrayCache: CoinrayCache, options = {} as any) {
    super();
    this.api = api;
    this.coinrayCache = coinrayCache;
    this.timeouts = {};
    this.maxTrades = options.maxTrades || 100;
    this.destroy();
  }

  setCoinraySymbol(coinraySymbol: string) {
    this.dispatchEvent('coinraySymbolWillChange', {coinraySymbol});
    this.stop();

    this.coinraySymbol = coinraySymbol;

    this.startOrderBook();
    this.startTrades();
    this.dispatchEvent('coinraySymbolChanged', {coinraySymbol});
  }

  destroy() {
    this.coinraySymbol = null;
    this.removeAllListeners();
    this.stop();
  }

  stop() {
    this.stopOrderBook();
    this.stopTrades();
  }

  getExchange() {
    return this.coinrayCache.getExchange(this.getMarket().exchangeCode)
  }

  getMarket() {
    if (this.coinraySymbol) {
      return this.coinrayCache.getMarket(this.coinraySymbol)
    } else {
      throw new MarketNotFoundError(`Market not found: ${this.coinraySymbol}`)
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
        if (trades.length === 0) {
          break;
        }

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
        if (bids.length === 0 || asks.length === 0) {
          break;
        }

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
    if (this.coinraySymbol && !this.orderBookStarted && this.hasListeners("orderBookUpdated")) {
      this.api.subscribeOrderBook({coinraySymbol: this.coinraySymbol}, this.handleOrderBook);
      this.orderBookStarted = true;
    }
  };

  stopOrderBook = () => {
    if (this.coinraySymbol) {
      this.api.unsubscribeOrderBook({coinraySymbol: this.coinraySymbol}, this.handleOrderBook);
    }
    this.orderBook = {
      minSeq: undefined,
      maxSeq: undefined,
      bids: {},
      asks: {}
    };

    this.orderBookStarted = false;
  };

  handleOrderBook = async ({type, coinraySymbol, orderBook}) => {
    if (this.coinraySymbol !== coinraySymbol) {
      this.api.unsubscribeOrderBook({coinraySymbol}, this.handleOrderBook);
      return
    }

    if (type === "orderBook:snapshot") {
      this.orderBook = {
        minSeq: undefined,
        maxSeq: undefined,
        bids: {},
        asks: {}
      };
    }

    const {minSeq, maxSeq, bids, asks} = orderBook;
    const update = (side, updates: OrderBookSide) => {
      _.forEach(updates, (quantity, price) => {
        if (quantity.gt(0)) {
          side[price] = {price: new BigNumber(price), quantity}
        } else {
          delete side[price]
        }
      })
    };

    if (minSeq - this.orderBook.maxSeq > 1) {
      this.stopOrderBook();
      this.startOrderBook();
      return
    }

    this.orderBook.minSeq = minSeq;
    this.orderBook.maxSeq = maxSeq;
    update(this.orderBook.bids, bids);
    update(this.orderBook.asks, asks);

    this.dispatchEvent("orderBookUpdated", {
      type, coinraySymbol, orderBook: {
        minSeq,
        maxSeq,
        bids: Object.values(this.orderBook.bids).sort(({price: left}, {price: right}) => right.minus(left)),
        asks: Object.values(this.orderBook.asks).sort(({price: left}, {price: right}) => left.minus(right)),
      }
    })
  };

  unsubscribeOrderBook = (callback) => {
    this.off('orderBookUpdated', callback)
    if (!this.hasListeners('orderBookUpdated')) {
      this.stopOrderBook();
    }
  };

  subscribeTrades = (callback) => {
    this.on('tradesUpdated', callback);
    this.startTrades();
    return callback;
  };

  startTrades = () => {
    if (this.coinraySymbol && !this.tradesStarted && this.hasListeners("tradesUpdated")) {
      this.api.subscribeTrades({coinraySymbol: this.coinraySymbol}, this.handleTrades);
      this.tradesStarted = true;
    }
  };

  stopTrades = () => {
    if (this.coinraySymbol) {
      this.api.unsubscribeTrades({coinraySymbol: this.coinraySymbol}, this.handleTrades);
    }
    this.trades = [];
    this.tradesStarted = false;
  };

  handleTrades = ({type, coinraySymbol, trades}) => {
    if (this.coinraySymbol !== coinraySymbol) {
      this.api.unsubscribeTrades({coinraySymbol}, this.handleTrades);
      return
    }

    if (type === "trades:snapshot") {
      this.trades = [];
    }

    this.trades = [...trades, ...this.trades]
      .sort((a, b) => b.time.getTime() - a.time.getTime())
      .slice(0, this.maxTrades);

    this.dispatchEvent('tradesUpdated', {type, coinraySymbol, trades: this.trades})

    if (!this.trades.length) return
    const delayInMs = Date.now() - this.trades[0].time.getTime()

    if (type === "trades:snapshot" && this.tradesDelayed) {
      this.dispatchTradesDelayed({type, coinraySymbol, tradesDelayed: false, delayInMs})
    } else if (type === "trades:update") {
      if (this.tradesDelayed && delayInMs < TRADES_DELAY_THRESHOLD) {
        this.dispatchTradesDelayed({type, coinraySymbol, tradesDelayed: false, delayInMs})
      } else if (!this.tradesDelayed && delayInMs >= TRADES_DELAY_THRESHOLD) {
        this.dispatchTradesDelayed({type, coinraySymbol, tradesDelayed: true, delayInMs})
      }
    }
  };

  dispatchTradesDelayed = ({type, coinraySymbol, tradesDelayed, delayInMs}) => {
    this.tradesDelayed = tradesDelayed
    this.dispatchEvent('tradesDelayed', {type, coinraySymbol, tradesDelayed, delayInMs})
  }

  unsubscribeTrades = (callback) => {
    this.off('tradesUpdated', callback)
    if (!this.hasListeners('tradesUpdated')) {
      this.stopTrades();
    }
  };

  subscribeTradesDelayed = (callback) => {
    this.on('tradesDelayed', callback);
    return callback;
  };

  unsubscribeTradesDelayed = (callback) => {
    this.off('tradesDelayed', callback)
  };

}
