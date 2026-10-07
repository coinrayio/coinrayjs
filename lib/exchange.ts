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
  public id: number;
  public name: string;
  public code: string;
  public websocket: boolean;
  public active: boolean;
  public aliasedTo: string | null;
  public tradingEnabled: boolean;
  public tradingEnabledFrom: string;
  public isFutures: boolean;
  public isDex: boolean;
  // Calculated exchange (CRAY, CRAYF): chart, alert and screener data only, never tradable
  public virtual: boolean;
  public logo: string;
  public btcVolume: BigNumber;
  public usdVolume: BigNumber;
  public totalMarkets: number;
  public quoteCurrencies: string[] | null;
  public supportedFeatures: string[] | null;
  public supportedResolutions: ExchangeFeatures[] | null;
  public supportedOrderTypes: OrderType[] | null;
  public baseCurrencyDominance: object | null;
  public apiKeySettings: ApiKeySettings;
  public apiEndpoint: string;
  public websocketEndpoint: string;

  public markets: MarketMap;
  public exchangeSymbols: {};

  public static Create(d: any, api: Coinray): Exchange {
    Exchange.check(d);
    return new Exchange(d, api);
  }

  private static check(d: any) {
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
    checkBoolean(d.virtual, true, "virtual");
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
  }

  private constructor(d: any, api: Coinray) {
    this.api = api;
    this.markets = {};
    this.exchangeSymbols = {}
    this._assign(d)
  }

  // Updates exchange fields in place (from /exchanges), keeping markets.
  update(d: any) {
    Exchange.check(d);
    this._assign(d);
  }

  private _assign(d: any) {
    const api = this.api
    this.id = d.id;
    this.name = d.name;
    this.code = d.code;
    this.websocket = d.websocket;
    this.isFutures = !!d.isFutures;
    this.isDex = !!d.isDex;
    this.virtual = !!d.virtual;
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
      virtual: this.virtual,
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

  // Merges /markets/static rows: existing markets updated in place, new ones created, missing ones dropped.
  // Returns the codes' symbols that were added and removed.
  mergeStatic(marketsData: Array<any>): { added: string[], removed: string[] } {
    const added: string[] = []
    const removed: string[] = []
    if (marketsData.length === 0) return {added, removed} // same guard as loadMarkets: never wipe on an empty list

    const next: MarketMap = {}
    for (const d of marketsData) {
      const existing = this.markets[d.coinraySymbol]
      try {
        if (existing) {
          existing.assignStatic(d)
          next[d.coinraySymbol] = existing
        } else {
          Market.checkStatic(d)
          next[d.coinraySymbol] = new Market(d, this.api, this)
          added.push(d.coinraySymbol)
        }
      } catch (error) {
        console.error(error)
        if (existing) next[d.coinraySymbol] = existing
      }
    }
    for (const [coinraySymbol, market] of Object.entries(this.markets)) {
      if (!next[coinraySymbol]) {
        market.removeAllListeners()
        removed.push(coinraySymbol)
      }
    }
    this.markets = next
    this.exchangeSymbols = _.keyBy(Object.values(next), "symbol")
    return {added, removed}
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
