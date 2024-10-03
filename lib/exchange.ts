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
import {ExchangeFeatures, IpWhiteList, MarketMap, OrderType} from "./types";
import _ from "lodash"
import Market from "./market";

export class ExtraSetting {
  public readonly key: string;
  public readonly label: string;
}

export class ApiVersion {
  public readonly value: string;
  public readonly label: string;
}

export class ApiKeySettings {
  public readonly ipWhiteList: IpWhiteList;
  public readonly extraKeys: boolean;
  public readonly passphraseRequired: boolean;
  public readonly extraSettings: ExtraSetting[] | null;
  public readonly versions: ApiVersion[] | null
}

export default class Exchange {
  public readonly api: Coinray;
  public readonly id: number;
  public readonly name: string;
  public readonly code: string;
  public readonly websocket: boolean;
  public readonly active: boolean;
  public readonly aliasedTo: string | null;
  public readonly tradingEnabled: boolean;
  public readonly tradingEnabledFrom: string;
  public readonly isFutures: boolean;
  public readonly isDex: boolean;
  public readonly logo: string;
  public readonly btcVolume: BigNumber;
  public readonly usdVolume: BigNumber;
  public readonly totalMarkets: number;
  public readonly quoteCurrencies: string[] | null;
  public readonly supportedFeatures: string[] | null;
  public readonly supportedResolutions: ExchangeFeatures[] | null;
  public readonly supportedOrderTypes: OrderType[] | null;
  public readonly baseCurrencyDominance: object | null;
  public readonly apiKeySettings: ApiKeySettings;
  public readonly apiEndpoint: string;
  public readonly websocketEndpoint: string;

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
    checkBoolean(d.active, false, "active");
    checkBoolean(d.tradingEnabled, false, "tradingEnabled");
    checkString(d.tradingEnabledFrom, false, "tradingEnabledFrom");
    checkBoolean(d.isFutures, true, "isFutures");
    checkBoolean(d.isDex, true, "isDex");
    checkString(d.logo, false, "logo");
    checkString(d.btcVolume, false, "btcVolume");
    checkString(d.usdVolume, false, "usdVolume");
    checkNumber(d.totalMarkets, false, "totalMarkets");
    checkArray(d.quoteCurrencies, "quoteCurrencies");
    checkString(d.apiEndpoint,  true, "apiEndpoint");
    checkString(d.websocketEndpoint, true, "websocketEndpoint");
    checkString(d.aliasedTo, true, "aliasedTo");

    if (d.quoteCurrencies) {
      for (let i = 0; i < d.quoteCurrencies.length; i++) {
        checkString(d.quoteCurrencies[i], false, "quoteCurrencies" + "[" + i + "]");
      }
    }
    if (d.quoteCurrencies === undefined) {
      d.quoteCurrencies = null;
    }
    checkArray(d.supportedResolutions, "supportedResolutions");
    checkArray(d.supportedFeatures, "supportedFeatures");
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
    this.isFutures = !!d.isFutures;
    this.isDex = !!d.isDex;
    this.active = d.active;
    this.tradingEnabled = d.tradingEnabled;
    this.tradingEnabledFrom = d.tradingEnabledFrom;
    this.logo = d.logo;
    this.btcVolume = safeBigNumber(d.btcVolume);
    this.usdVolume = safeBigNumber(d.usdVolume);
    this.totalMarkets = safeInteger(d.totalMarkets);
    this.quoteCurrencies = d.quoteCurrencies;
    this.supportedResolutions = d.supportedResolutions;
    this.supportedFeatures = d.supportedFeatures;
    this.supportedOrderTypes = d.supportedOrderTypes;
    this.baseCurrencyDominance = d.baseCurrencyDominance;
    this.apiKeySettings = d.apiKeySettings;
    this.markets = {};
    this.exchangeSymbols = {}
    this.apiEndpoint = d.apiEndpoint || api.config.apiEndpoint
    this.websocketEndpoint = d.websocketEndpoint || api.config.websocketEndpoint
    this.aliasedTo = d.aliasedTo
  }

  clone() {
    return new Exchange({
      api: this.api,
      id: this.id,
      name: this.name,
      code: this.code,
      websocket: this.websocket,
      isFutures: this.isFutures,
      isDex: this.isDex,
      logo: this.logo,
      btcVolume: this.btcVolume,
      usdVolume: this.usdVolume,
      totalMarkets: this.totalMarkets,
      quoteCurrencies: this.quoteCurrencies,
      supportedResolutions: this.supportedResolutions,
      supportedFeatures: this.supportedFeatures,
      baseCurrencyDominance: this.baseCurrencyDominance,
      apiKeySettings: this.apiKeySettings,
      aliasedTo: this.aliasedTo
    }, this.api)
  }

  async loadMarkets(apiCache = undefined): Promise<Array<object>> {
    const marketsData = await this.api.fetchMarkets(this, apiCache)
    const markets = marketsData.map((market) => {
      try {
        return Market.Create(market, this.api, this)
      } catch (error) {
        return new Market(market, this.api, this)
      }
    })

    if (markets.length > 0) {
      this.markets = _.keyBy(markets, "coinraySymbol");
      this.exchangeSymbols = _.keyBy(markets, "symbol");
    }
    return marketsData
  }

  getBaseCurrencyDominance(baseCurrency) {
    return this.baseCurrencyDominance[baseCurrency]
  }

  getMarketByExchangeSymbol(exchangeSymbol) {
    return this.exchangeSymbols[exchangeSymbol]
  }

  getCurrencyPrice(usdValue, currency) {
    for (let [_, market] of Object.entries(this.markets)) {
      if (market.baseCurrency === currency) {
        return safeBigNumber(usdValue).dividedBy(market.baseToUsd)
      } else if (market.quoteCurrency === currency) {
        return safeBigNumber(usdValue).dividedBy(market.quoteToUsd)
      }
    }
    return new BigNumber(0)
  }

  getUsdPrice(value, currency) {
    for (let [_, market] of Object.entries(this.markets)) {
      if (market.baseCurrency === currency) {
        return market.baseToUsd.multipliedBy(value)
      } else if (market.quoteCurrency === currency) {
        return market.quoteToUsd.multipliedBy(value)
      }
    }
    return new BigNumber(0)
  }

  getMarket(coinraySymbol) {
    return this.markets[coinraySymbol]
  }
}
