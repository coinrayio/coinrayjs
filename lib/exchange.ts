// Stores the currently-being-typechecked object for error messages.

import {
  checkArray,
  checkBoolean,
  checkNumber,
  checkString,
  safeBigNumber,
  safeInteger,
  throwIsArray,
  throwNotObject,
  throwNull2NonNull
} from "./util";
import BigNumber from "bignumber.js";
import Coinray from "./coinray";
import {MarketMap, OrderType} from "./types";


export default class Exchange {
  public readonly api: Coinray;
  public readonly id: number;
  public readonly name: string;
  public readonly code: string;
  public readonly websocket: boolean;
  public readonly logo: string;
  public readonly btcVolume: BigNumber;
  public readonly usdVolume: BigNumber;
  public readonly totalMarkets: number;
  public readonly quoteCurrencies: string[] | null;
  public readonly supportedResolutions: string[] | null;
  public readonly supportedOrderTypes: OrderType[] | null;
  public markets: MarketMap;
  public exchangeSymbols: {};

  public static Create(d: any, api: Coinray): Exchange {
    if (d === null || d === undefined) {
      throwNull2NonNull(d);
    } else if (typeof (d) !== 'object') {
      throwNotObject(d, false);
    } else if (Array.isArray(d)) {
      throwIsArray(d, false);
    }
    checkNumber(d.id, false, "id");
    checkString(d.name, false, "name");
    checkString(d.code, false, "code");
    checkBoolean(d.websocket, false, "websocket");
    checkString(d.logo, false, "logo");
    checkString(d.btcVolume, false, "btcVolume");
    checkString(d.usdVolume, false, "usdVolume");
    checkNumber(d.totalMarkets, false, "totalMarkets");
    checkArray(d.quoteCurrencies, "quoteCurrencies");
    if (d.quoteCurrencies) {
      for (let i = 0; i < d.quoteCurrencies.length; i++) {
        checkString(d.quoteCurrencies[i], false, "quoteCurrencies" + "[" + i + "]");
      }
    }
    if (d.quoteCurrencies === undefined) {
      d.quoteCurrencies = null;
    }
    checkArray(d.supportedResolutions, "supportedResolutions");
    if (d.supportedResolutions) {
      for (let i = 0; i < d.supportedResolutions.length; i++) {
        checkString(d.supportedResolutions[i], false, "supportedResolutions" + "[" + i + "]");
      }
    }
    if (d.supportedResolutions === undefined) {
      d.supportedResolutions = null;
    }
    return new Exchange(d, api);
  }

  private constructor(d: any, api: Coinray) {
    this.api = api;
    this.id = d.id;
    this.name = d.name;
    this.code = d.code;
    this.websocket = d.websocket;
    this.logo = d.logo;
    this.btcVolume = safeBigNumber(d.btcVolume);
    this.usdVolume = safeBigNumber(d.usdVolume);
    this.totalMarkets = safeInteger(d.totalMarkets);
    this.quoteCurrencies = d.quoteCurrencies;
    this.supportedResolutions = d.supportedResolutions;
    this.supportedOrderTypes = d.supportedOrderTypes;
    this.markets = {};
    this.exchangeSymbols = {}
  }

  clone() {
    return new Exchange({
      api: this.api,
      id: this.id,
      name: this.name,
      code: this.code,
      websocket: this.websocket,
      logo: this.logo,
      btcVolume: this.btcVolume,
      usdVolume: this.usdVolume,
      totalMarkets: this.totalMarkets,
      quoteCurrencies: this.quoteCurrencies,
      supportedResolutions: this.supportedResolutions,
    }, this.api)
  }

  async loadMarkets() {
    const markets = await this.api.fetchMarkets(this.code);

    markets.reduce((mem, market) => {
      mem[market.coinraySymbol] = market;
      this.exchangeSymbols[market.symbol] = market;
      return mem;
    }, this.markets)
  }

  getMarketByExchangeSymbol(exchangeSymbol) {
    return this.exchangeSymbols[exchangeSymbol]
  }

  getMarket(coinraySymbol) {
    return this.markets[coinraySymbol]
  }
}