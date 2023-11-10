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
import {OrderType} from "./types";

let obj: any = null;

export default class Market {
  public getExchange: () => Exchange
  public readonly api: Coinray;
  public readonly id: number;
  public readonly coinraySymbol: string;
  public readonly symbol: string;
  public readonly symbolAlt: string;
  public readonly quoteCurrency: string;
  public readonly underlyingQuoteCurrency: string;
  public readonly baseCurrency: string;
  public readonly exchangeCode: string;
  public readonly volume: BigNumber;
  public readonly quoteVolume: BigNumber;
  public readonly btcVolume: BigNumber;
  public readonly usdVolume: BigNumber;
  public readonly websocket: boolean;
  public readonly openPrice: BigNumber;
  public readonly highPrice: BigNumber;
  public readonly lowPrice: BigNumber;
  public readonly precisionBase: number;
  public readonly precisionQuote: number;
  public readonly precisionPrice: number;
  public readonly minBase: number;
  public readonly maxBase: BigNumber;
  public readonly minQuote: number;
  public readonly maxQuote: BigNumber;
  public readonly minTrade?: BigNumber;
  public readonly maxTrade?: BigNumber;
  public readonly makerFee: number;
  public readonly takerFee: number;
  public readonly change: number;
  public readonly delistedOn: string;
  public readonly exchangeUrl: string;
  public readonly baseToUsd: BigNumber;
  public readonly quoteToUsd: BigNumber;
  public readonly status: string;
  public readonly note: string;
  private readonly _supportedOrderTypes: OrderType[] | null;
  public lastPrice?: BigNumber;
  public askPrice: BigNumber;
  public bidPrice: BigNumber;
  public readonly updatedAt: string;

  public static Create(d: any, api: Coinray, exchange: Exchange): Market {
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
    checkString(d.baseCurrency, false, "baseCurrency");
    checkString(d.exchangeCode, false, "exchangeCode");
    checkString(d.status || "", false, "status");
    checkString(d.note || "", false, "note");
    checkBigNumber(d.volume, true, "volume");
    checkBigNumber(d.quoteVolume, true, "quoteVolume");
    checkBigNumber(d.btcVolume, true, "btcVolume");
    checkBigNumber(d.usdVolume, true, "usdVolume");
    checkBoolean(d.websocket, false, "websocket");
    checkBigNumber(d.openPrice, true, "openPrice");
    checkBigNumber(d.highPrice, true, "highPrice");
    checkBigNumber(d.lowPrice, true, "lowPrice");
    checkNumber(d.precisionBase, false, "precisionBase");
    checkNumber(d.precisionPrice, false, "precisionPrice");
    checkNumber(d.precisionBase, false, "precisionBase");
    checkNumber(d.minBase, true, "minBase");
    checkNumber(d.precisionQuote, false, "precisionQuote");
    checkNumber(d.minQuote, true, "minQuote");
    checkBigNumber(d.maxBase, true, "maxBase");
    checkBigNumber(d.maxQuote, true, "maxQuote");
    checkBigNumber(d.minTrade, false, "minTrade");
    checkNumber(d.maxTrade, true, "maxTrade");
    if (d.maxTrade === undefined) {
      d.maxTrade = null;
    }
    checkNumber(d.makerFee, false, "makerFee");
    checkNumber(d.takerFee, false, "takerFee");
    checkNumber(d.change, false, "change");
    checkNull(d.delistedOn, "delistedOn");
    if (d.delistedOn === undefined) {
      d.delistedOn = null;
    }
    checkString(d.exchangeUrl, false, "exchangeUrl");
    checkBigNumber(d.lastPrice, true, "lastPrice");
    checkBigNumber(d.baseToUsd, false, "baseToUsd");
    checkBigNumber(d.quoteToUsd, false, "quoteToUsd");
    checkBigNumber(d.askPrice, true, "askPrice");
    checkBigNumber(d.bidPrice, true, "bidPrice");
    checkString(d.updatedAt, false, "updatedAt");
    return new Market(d, api, exchange);
  }

  constructor(d: any, api: Coinray, exchange: Exchange) {
    this.getExchange = () => exchange
    this.api = api;
    this.id = d.id;
    this.coinraySymbol = d.coinraySymbol;
    this.symbol = d.symbol;
    this.symbolAlt = d.symbolAlt;
    this.quoteCurrency = d.quoteCurrency.toUpperCase();
    this.underlyingQuoteCurrency = d.underlyingQuoteCurrency.toUpperCase();
    this.baseCurrency = d.baseCurrency.toUpperCase();
    this.exchangeCode = d.exchangeCode;
    this.status = d.status;
    this.note = d.note;
    this.volume = safeBigNumber(d.volume);
    this.quoteVolume = safeBigNumber(d.quoteVolume);
    this.btcVolume = safeBigNumber(d.btcVolume);
    this.usdVolume = safeBigNumber(d.usdVolume);
    this.websocket = d.websocket;
    this.openPrice = safeBigNumber(d.openPrice);
    this.highPrice = safeBigNumber(d.highPrice);
    this.lowPrice = safeBigNumber(d.lowPrice);
    this.precisionBase = d.precisionBase;
    this.precisionPrice = d.precisionPrice;
    this.precisionQuote = d.precisionQuote;
    this.minQuote = d.minQuote;
    this.precisionBase = d.precisionBase;
    this.minBase = d.minBase;
    this.maxBase = safeBigNumber(d.maxBase);
    this.maxQuote = safeBigNumber(d.maxQuote);
    this.minTrade = safeBigNumber(d.minTrade);
    this.maxTrade = safeBigNumber(d.maxTrade);
    this.makerFee = safeFloat(d.makerFee);
    this.takerFee = safeFloat(d.takerFee);
    this.change = safeFloat(d.change);
    this.delistedOn = d.delistedOn;
    this.exchangeUrl = d.exchangeUrl;
    this.lastPrice = safeBigNumber(d.lastPrice);
    this.baseToUsd = safeBigNumber(d.baseToUsd);
    this.quoteToUsd = safeBigNumber(d.quoteToUsd);
    this.askPrice = safeBigNumber(d.askPrice);
    this.bidPrice = safeBigNumber(d.bidPrice);
    this._supportedOrderTypes = d.supportedOrderTypes;
    this.updatedAt = d.updatedAt;
  }

  get tradingDisabled() {
    return this.status === "INACTIVE"
  }

  get tradingEnabled() {
    return !this.tradingDisabled
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

  get fullDisplayName() {
    return [this.exchangeCode, this.displayName].join(": ")
  }

  get displayName() {
    return [this.baseCurrency, this.quoteCurrency].join("/")
  }

  updateTicker = ({lastPrice, bidPrice, askPrice}: any) => {
    if (lastPrice) {
      this.lastPrice = lastPrice
    }

    if (askPrice) {
      this.askPrice = askPrice
    }

    if (bidPrice) {
      this.bidPrice = bidPrice
    }
  }
}
