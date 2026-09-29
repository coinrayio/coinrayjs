// Stores the currently-being-typechecked object for error messages.
import BigNumber from "bignumber.js";
import {
  checkBigNumber,
  checkBoolean,
  checkNull,
  checkNumber,
  checkString,
  safeBigNumber,
  safeFloat,
  throwIsArray,
  throwNotObject,
  throwNull2NonNull
} from "./util";
import Coinray from "./coinray";
import Exchange from "./exchange";
import {FuturesSettings, OrderType, Ticker, TickerSnapshot, TradingSession} from "./types";
import EventEmitter from "./event-emitter";

export default class Market extends EventEmitter {
  public getExchange: () => Exchange
  public readonly api: Coinray;
  public id: number;
  public coinraySymbol: string;
  public symbol: string;
  public symbolAlt: string;
  public quoteCurrency: string;
  public underlyingQuoteCurrency: string;
  public baseLogoUrl: string;
  public baseCurrency: string;
  public exchangeCode: string;
  public volume: BigNumber;
  public quoteVolume: BigNumber;
  public btcVolume: BigNumber;
  public usdVolume: BigNumber;
  public websocket: boolean;
  public openPrice: BigNumber;
  public highPrice: BigNumber;
  public lowPrice: BigNumber;
  public precisionBase: number;
  public precisionQuote: number;
  public precisionPrice: number;
  public minBase: number;
  public maxBase: BigNumber;
  public maxBaseMarket: BigNumber;
  public minQuote: number;
  public maxQuote: BigNumber;
  public minTrade?: BigNumber;
  public maxTrade?: BigNumber;
  public makerFee: number;
  public takerFee: number;
  public change: number;
  public delistedOn: string;
  public exchangeUrl: string;
  public baseToUsd: BigNumber;
  public quoteToUsd: BigNumber;
  public status: string;
  public note: string;
  private _supportedOrderTypes: OrderType[] | null;
  public _lastPrice?: BigNumber;
  public _askPrice: BigNumber;
  public _bidPrice: BigNumber;
  public updatedAt: string;
  public futuresSettings?: FuturesSettings;
  public symbolTv?: string;
  public tradingSessions?: TradingSession[] | null;
  public syntheticTrades: boolean;
  public marketCap: BigNumber;
  private _groupName?: string | null;
  public getPriceOverrides: any

  public static Create(d: any, api: Coinray, exchange: Exchange): Market {
    Market.checkStatic(d);
    Market.checkDynamic(d);
    return new Market(d, api, exchange);
  }

  static checkStatic(d: any) {
    if (d === null || d === undefined) {
      throwNull2NonNull(d);
    } else if (typeof (d) !== 'object') {
      throwNotObject(d, false);
    } else if (Array.isArray(d)) {
      throwIsArray(d, false);
    }
    checkNumber(d.id, false, "id");
    checkString(d.coinraySymbol, false, "coinraySymbol");
    checkString(d.symbol, false, "symbol");
    checkString(d.symbolAlt, false, "symbolAlt");
    checkString(d.quoteCurrency, false, "quoteCurrency");
    checkString(d.underlyingQuoteCurrency, false, "underlyingQuoteCurrency");
    checkString(d.baseLogoUrl, true, "baseLogoUrl");
    checkString(d.baseCurrency, false, "baseCurrency");
    checkString(d.exchangeCode, false, "exchangeCode");
    checkString(d.status || "", false, "status");
    checkString(d.note || "", false, "note");
    checkBoolean(d.websocket, false, "websocket");
    checkNumber(d.precisionBase, false, "precisionBase");
    checkNumber(d.precisionPrice, false, "precisionPrice");
    checkNumber(d.minBase, true, "minBase");
    checkNumber(d.precisionQuote, false, "precisionQuote");
    checkNumber(d.minQuote, true, "minQuote");
    checkBigNumber(d.maxBase, true, "maxBase");
    checkBigNumber(d.maxBaseMarket, true, "maxBaseMarket");
    checkBigNumber(d.maxQuote, true, "maxQuote");
    checkBigNumber(d.minTrade, false, "minTrade");
    checkNumber(d.maxTrade, true, "maxTrade");
    if (d.maxTrade === undefined) {
      d.maxTrade = null;
    }
    checkNumber(d.makerFee, false, "makerFee");
    checkNumber(d.takerFee, false, "takerFee");
    checkNull(d.delistedOn, "delistedOn");
    if (d.delistedOn === undefined) {
      d.delistedOn = null;
    }
    checkString(d.exchangeUrl, false, "exchangeUrl");
    checkString(d.symbolTv, true, "symbolTv");
    checkString(d.groupName, true, "groupName");
    if (d.futuresSettings !== null && d.futuresSettings !== undefined) {
      const fs = d.futuresSettings;
      checkString(fs.tenor, false, "futuresSettings.tenor");
      checkString(fs.margin, false, "futuresSettings.margin");
      checkString(fs.expiresAt, true, "futuresSettings.expiresAt");
      checkNumber(fs.fundingIntervalSeconds, true, "futuresSettings.fundingIntervalSeconds");
      checkBigNumber(fs.maxLeverage, true, "futuresSettings.maxLeverage");
      checkString(fs.groupName, true, "futuresSettings.groupName");
    }
  }

  private static checkDynamic(d: any) {
    checkBigNumber(d.volume, true, "volume");
    checkBigNumber(d.quoteVolume, true, "quoteVolume");
    checkBigNumber(d.btcVolume, true, "btcVolume");
    checkBigNumber(d.usdVolume, true, "usdVolume");
    checkBigNumber(d.openPrice, true, "openPrice");
    checkBigNumber(d.highPrice, true, "highPrice");
    checkBigNumber(d.lowPrice, true, "lowPrice");
    checkNumber(d.change, false, "change");
    checkBigNumber(d.lastPrice, true, "lastPrice");
    checkBigNumber(d.baseToUsd, false, "baseToUsd");
    checkBigNumber(d.quoteToUsd, false, "quoteToUsd");
    checkBigNumber(d.askPrice, true, "askPrice");
    checkBigNumber(d.bidPrice, true, "bidPrice");
    checkString(d.updatedAt, false, "updatedAt");
    checkBigNumber(d.marketCap, true, "marketCap");
  }

  constructor(d: any, api: Coinray, exchange: Exchange) {
    super()
    this.getExchange = () => exchange
    this.api = api;
    this._assignStatic(d);
    this.volume = safeBigNumber(d.volume);
    this.quoteVolume = safeBigNumber(d.quoteVolume);
    this.btcVolume = safeBigNumber(d.btcVolume);
    this.usdVolume = safeBigNumber(d.usdVolume);
    this.openPrice = safeBigNumber(d.openPrice);
    this.highPrice = safeBigNumber(d.highPrice);
    this.lowPrice = safeBigNumber(d.lowPrice);
    this.change = safeFloat(d.change) || 0; // static-only rows have no change
    this._lastPrice = safeBigNumber(d.lastPrice);
    this.baseToUsd = safeBigNumber(d.baseToUsd);
    this.quoteToUsd = safeBigNumber(d.quoteToUsd);
    this._askPrice = safeBigNumber(d.askPrice);
    this._bidPrice = safeBigNumber(d.bidPrice);
    this.updatedAt = d.updatedAt;
    this.marketCap = safeBigNumber(d.marketCap);
  }

  // Updates static fields in place (from /markets/static), validated like Market.Create.
  assignStatic = (d: any) => {
    Market.checkStatic(d);
    this._assignStatic(d);
  }

  private _assignStatic(d: any) {
    this.id = d.id;
    this.coinraySymbol = d.coinraySymbol;
    this.symbol = d.symbol;
    this.symbolAlt = d.symbolAlt;
    this.quoteCurrency = d.quoteCurrency.toUpperCase();
    this.underlyingQuoteCurrency = d.underlyingQuoteCurrency.toUpperCase();
    this.baseLogoUrl = d.baseLogoUrl;
    this.baseCurrency = d.baseCurrency.toUpperCase();
    this.exchangeCode = d.exchangeCode;
    this.status = d.status;
    this.note = d.note;
    this.websocket = d.websocket;
    this.precisionBase = d.precisionBase;
    this.precisionPrice = d.precisionPrice;
    this.precisionQuote = d.precisionQuote;
    this.minQuote = d.minQuote;
    this.minBase = d.minBase;
    this.maxBase = safeBigNumber(d.maxBase);
    this.maxBaseMarket = safeBigNumber(d.maxBaseMarket).isZero() ? this.maxBase : safeBigNumber(d.maxBaseMarket);
    this.maxQuote = safeBigNumber(d.maxQuote);
    this.minTrade = safeBigNumber(d.minTrade);
    this.maxTrade = safeBigNumber(d.maxTrade);
    this.makerFee = safeFloat(d.makerFee);
    this.takerFee = safeFloat(d.takerFee);
    this.delistedOn = d.delistedOn;
    this.exchangeUrl = d.exchangeUrl;
    this._supportedOrderTypes = d.supportedOrderTypes;
    this.symbolTv = d.symbolTv;
    this._groupName = d.groupName;
    this.tradingSessions = d.tradingSessions ?? null;
    this.syntheticTrades = d.syntheticTrades ?? false;
    this.futuresSettings = undefined;
    if (d.futuresSettings !== null && d.futuresSettings !== undefined) {
      const fs = d.futuresSettings;
      this.futuresSettings = {
        tenor: fs.tenor,
        margin: fs.margin,
        expiresAt: fs.expiresAt ? new Date(fs.expiresAt) : null,
        fundingIntervalSeconds: fs.fundingIntervalSeconds ?? null,
        maxLeverage: fs.maxLeverage !== null && fs.maxLeverage !== undefined ? safeBigNumber(fs.maxLeverage) : null,
        groupName: fs.groupName ?? undefined,
      };
    }
  }

  get tradingDisabled() {
    return this.status === "INACTIVE"
  }

  get tradingEnabled() {
    return !this.tradingDisabled
  }

  get quoteLogoUrl() {
    return `https://api.coinray.eu/api/v2/explorer/currencies/${this.quoteCurrency}/thumb`
  }

  get supportedOrderTypes() {
    if (this._supportedOrderTypes.length > 0) {
      return this._supportedOrderTypes
    } else {
      return this.getExchange().supportedOrderTypes
    }
  }

  get isFutures() {
    return this.getExchange().isFutures
  }

  get groupName(): string | undefined {
    return this._groupName ?? this.futuresSettings?.groupName
  }

  get fullDisplayName() {
    return [this.exchangeCode, this.displayName].join(": ")
  }

  get displayName() {
    return [this.baseCurrency, this.quoteCurrency].join("/")
  }

  get priceOverrides() {
    return this.getPriceOverrides ? this.getPriceOverrides() : {}
  }

  get lastPrice() {
    return this.priceOverrides.lastPrice || this._lastPrice
  }

  get askPrice() {
    return this.priceOverrides.askPrice || this._askPrice
  }

  get bidPrice() {
    return this.priceOverrides.bidPrice || this._bidPrice
  }

  overridePrices = (getPriceOverrides: any) => {
    this.getPriceOverrides = getPriceOverrides
  }

  updateLastPrice = (lastPrice: BigNumber) => {
    this._lastPrice = lastPrice;
    this.change = this.openPrice.isZero() ? 0 : this.lastPrice.minus(this.openPrice).dividedBy(this.openPrice).multipliedBy(100).toNumber();
    this.dispatchEvent("price")
  }

  updateBidAsk = (bidPrice: BigNumber, askPrice: BigNumber) => {
    this._bidPrice = bidPrice;
    this._askPrice = askPrice;

    this.dispatchEvent("bidask")
  }

  updateTicker = (ticker: Ticker) => {
    this.openPrice = ticker.openPrice24h;
    this.highPrice = ticker.highPrice24h;
    this.lowPrice = ticker.lowPrice24h;
    this.volume = ticker.baseVolume;
    this.quoteVolume = ticker.quoteVolume;
    this.btcVolume = ticker.btcVolume;
    this.usdVolume = ticker.usdVolume;

    this.updateBidAsk(ticker.bidPrice, ticker.askPrice)
    this.updateLastPrice(ticker.lastPrice);
    this.dispatchEvent("ticker")
  }

  // REST 24h snapshot. `live` = the websocket feeds this market (ticker subscription or current market),
  // which is fresher, so prices and 24h OHL are left alone.
  applySnapshot = (t: TickerSnapshot, live = false) => {
    if (!live) {
      this._lastPrice = t.lastPrice;
      this._bidPrice = t.bidPrice;
      this._askPrice = t.askPrice;
      this.openPrice = t.openPrice24h;
      this.highPrice = t.highPrice24h;
      this.lowPrice = t.lowPrice24h;
      this.change = this.openPrice.isZero() ? 0 : this._lastPrice.minus(this.openPrice).dividedBy(this.openPrice).multipliedBy(100).toNumber();
    }
    this.volume = t.baseVolume;
    this.quoteVolume = t.quoteVolume;
    this.btcVolume = t.btcVolume;
    this.usdVolume = t.usdVolume;
    this.baseToUsd = t.baseToUsd;
    this.quoteToUsd = t.quoteToUsd;
    this.marketCap = t.marketCap;
    this.dispatchEvent("ticker")
  }

  clone(): Market {
    // Create a plain object snapshot of this instance
    const snapshot: any = {
      ...this,
      volume: this.volume,
      quoteVolume: this.quoteVolume,
      btcVolume: this.btcVolume,
      usdVolume: this.usdVolume,
      marketCap: this.marketCap,
      openPrice: this.openPrice,
      highPrice: this.highPrice,
      lowPrice: this.lowPrice,
      lastPrice: this._lastPrice,
      askPrice: this._askPrice,
      bidPrice: this._bidPrice,
      maxBase: this.maxBase,
      maxBaseMarket: this.maxBaseMarket,
      maxQuote: this.maxQuote,
      minTrade: this.minTrade,
      maxTrade: this.maxTrade,
      baseToUsd: this.baseToUsd,
      quoteToUsd: this.quoteToUsd,
      groupName: this._groupName,
    };

    // Construct a new Market with the same API and exchange references
    const cloned = new Market(snapshot, this.api, this.getExchange());

    // Copy event listeners or other dynamic state if necessary
    cloned.getPriceOverrides = this.getPriceOverrides;
    cloned.listeners = this.listeners

    return cloned;
  }
}
