import axios, {AxiosRequestConfig, Method} from "axios";
import {Channel, Socket} from "phoenix";
import {camelize, createJWT, encryptPayload, jwtExpired, MINUTES, safeBigNumber, safeTime, signHMAC} from "./util";
import _ from "lodash"

import {JWK} from "node-jose";
import {
  CancelOrderParams,
  Candle,
  CandleParam,
  CandlesParam,
  CreateOrderParams,
  MarketParam, OrderBook,
  UpdateOrderParams,
  Trade, TradeList, OrderBookEntry,
} from "./types";
import Market from "./market";
import Exchange from "./exchange";
import BigNumber from "bignumber.js";

const VERSION = require('../package.json').version;

export class CoinrayError extends Error {
  errorCode: number;
  errorMessage: string;

  constructor({code, message}) {
    super("Request failed");
    this.name = "CoinrayError";
    this.errorCode = code;
    this.errorMessage = message;
  }
}

export default class Coinray {
  config: {
    apiEndpoint: string;
    websocketEndpoint: string;
  };
  private _token: string;
  private _sessionKey: string;
  private _credential: string;
  private _onTokenExpired?: () => Promise<string>;
  private _tokenCheckInterval: any;
  private _onError?: (event: any) => void;
  private _onOpen?: (event: any) => void;
  private _socket?: Socket;
  private _transport: any;

  private _tradeListeners: any = {};
  private _orderbookListeners: any = {};

  private _candleTradeListeners: any = {};
  private _candleListeners: any = {};
  private _candles: any = {};

  private _channels: any = {};
  private _connected: Promise<boolean>;
  private markConnected: any;
  private _publicKey: any;
  _refreshingToken: Promise<string>;
  private onReconnect: any;

  constructor(token: string, apiEndpoint = "https://coinray.io", websocketEndpoint = "wss://ws.coinray.io/v1") {
    this._token = token;
    this.config = {
      apiEndpoint,
      websocketEndpoint
    }
  }

  authenticateDevice(credential: string, sessionKey: string) {
    this._credential = credential;
    this._sessionKey = sessionKey;
  }

  destroy() {
    this._tradeListeners = {};
    this._channels = {};

    if (this._tokenCheckInterval) {
      clearInterval(this._tokenCheckInterval)
    }
    this.disconnect()
  }

  checkToken = async () => {
    if (jwtExpired(this._token) && this._onTokenExpired) {
      if (!this._refreshingToken) {
        this._refreshingToken = this._onTokenExpired();
      }
      this._token = await this._refreshingToken;
      if (!jwtExpired(this._token)) {
        this.reconnect()
      } else {
        return false
      }
    }
    return true;
  };

  setTransport(transport: any) {
    this._transport = transport
  }

  onTokenExpired(callback: () => Promise<string>) {
    this._onTokenExpired = callback;
    this._tokenCheckInterval = setInterval(this.checkToken, 5000);
  }

  refreshToken(token: string) {
    this._token = token;
  }

  async getToken() {
    const tokenValid = await this.checkToken();
    if (tokenValid) {
      return this._token
    } else {
      throw new Error("Token is expired. call refreshToken in the onTokenExpired callback")
    }
  }

  reconnect = () => {
    if (this._connected) {
      // @ts-ignore
      this.socket.conn.close();
      Object.keys(this._tradeListeners).forEach((coinraySymbol) => {
        const channel = this.getChannel("trades");
        channel.push("subscribe", {symbols: coinraySymbol, snapshots: true}, 5000);
      });
      Object.keys(this._orderbookListeners).forEach((coinraySymbol) => {
        const channel = this.getChannel("orderbooks");
        channel.push("subscribe", {symbols: coinraySymbol, snapshots: true}, 5000);
      });
    }
  };

  disconnect = () => {
    if (this._socket) {
      this._socket.disconnect();
      this._socket = undefined
    }
    this._connected = undefined
  };

  async connect() {
    if (this._connected) {
      await this._connected;
      return
    } else {
      this._connected = new Promise((resolve) => {
        this.markConnected = resolve
      })
    }

    // @ts-ignore
    this.socket.onOpen((event: any) => {
      if (this._onOpen) {
        this._onOpen(event)
      }
    });

    // @ts-ignore
    this.socket.onError((event: any) => {
      if (this._onError) {
        this._onError(event)
      }
    });

    this.socket.connect();
    this.markConnected();
  }

  onOpen(callback: (event: any) => void) {
    this._onOpen = callback
  }

  onError(callback: (event: any) => void) {
    this._onError = callback
  }

  async subscribeTrades({coinraySymbol}: MarketParam, callback: (payload: any) => void) {
    if (this._tradeListeners[coinraySymbol] && this._tradeListeners[coinraySymbol].length > 0) {
      this._tradeListeners[coinraySymbol].push(callback);
      return callback
    }
    this._tradeListeners[coinraySymbol] = [callback];

    await this.connect();
    const channel = this.getChannel("trades");
    channel.on("snapshot", ({symbol, trades}) => {
      const callbacks = Object.values(this._tradeListeners[symbol]) as [];
      const parsedTrades = trades.map(Coinray._parseTrade);
      callbacks.map((callback: (payload: any) => void) => callback({
        type: "trades:snapshot",
        coinraySymbol: symbol,
        trades: parsedTrades
      }))
    });
    channel.on("update", ({symbol, trades}) => {
      const callbacks = Object.values(this._tradeListeners[symbol]) as [];
      const parsedTrades = trades.map(Coinray._parseTrade);
      callbacks.map((callback: (payload: any) => void) => callback({
        type: "trades:update",
        coinraySymbol: symbol,
        trades: parsedTrades
      }))
    });
    channel.on("error", (payload) => console.error(payload));
    channel.push("subscribe", {symbols: coinraySymbol, snapshots: true}, 5000);

    return callback
  }

  unsubscribeTrades({coinraySymbol}: MarketParam, callback?: (payload: any) => void) {
    if (callback && this._tradeListeners[coinraySymbol]) {
      this._tradeListeners[coinraySymbol] = this._tradeListeners[coinraySymbol].filter((c: (payload: any) => void) => c !== callback)

      if (this._tradeListeners[coinraySymbol].length === 0) {
        this.getChannel("trades")
            .push("unsubscribe", {symbols: coinraySymbol}, 5000)
      }
    } else {
      this._tradeListeners[coinraySymbol] = []
    }
  }

  async subscribeOrderBook({coinraySymbol}: MarketParam, callback: (payload: any) => void) {
    if (this._orderbookListeners[coinraySymbol] && this._orderbookListeners[coinraySymbol].length > 0) {
      this._orderbookListeners[coinraySymbol].push(callback);
      return callback
    }
    this._orderbookListeners[coinraySymbol] = [callback];

    await this.connect();
    const channel = this.getChannel("orderbooks");
    channel.on("snapshot", ({orderbooks}) => {
      const incoming_symbols = Object.keys(orderbooks);
      incoming_symbols.forEach(symbol => {
        const callbacks = Object.values(this._orderbookListeners[symbol]) as [];
        const parsedOrderBook = Coinray._parseOrderBook(orderbooks[symbol]);
        callbacks.map((callback: (payload: any) => void) => callback({
          type: "orderBook:snapshot",
          coinraySymbol: symbol,
          orderBook: parsedOrderBook
        }))
      })
    });
    channel.on("update", ({orderbooks}) => {
      const incoming_symbols = Object.keys(orderbooks);
      incoming_symbols.forEach(symbol => {
        const callbacks = Object.values(this._orderbookListeners[symbol]) as [];
        const parsedOrderBook = Coinray._parseOrderBook(orderbooks[symbol]);
        callbacks.map((callback: (payload: any) => void) => callback({
          type: "orderBook:update",
          coinraySymbol: symbol,
          orderBook: parsedOrderBook
        }))
      })
    });
    channel.on("error", (payload) => console.error(payload));
    channel.push("subscribe", {symbols: coinraySymbol}, 10000);
    return callback
  }

  unsubscribeOrderBook({coinraySymbol}: MarketParam, callback?: (payload: any) => void) {
    if (callback && this._orderbookListeners[coinraySymbol]) {
      this._orderbookListeners[coinraySymbol] = this._orderbookListeners[coinraySymbol].filter((c: (payload: any) => void) => c !== callback)

      if (this._orderbookListeners[coinraySymbol].length === 0) {
        this.getChannel("orderbooks")
            .push("unsubscribe", {symbols: coinraySymbol}, 5000)
      }
    } else {
      this._orderbookListeners[coinraySymbol] = []
    }
  }

  async subscribeCandles({coinraySymbol, resolution}: CandleParam, callback: (payload: any) => void) {
    const candleId = `${coinraySymbol}-${resolution}`;

    if (this._candleListeners[candleId] && this._candleListeners[candleId].length > 0) {
      this._candleListeners[candleId].push(callback);
      return callback
    }
    this._candleListeners[candleId] = [callback];

    const candleCallback = ({coinraySymbol, trades}: any) => {
      const callbacks = Object.values(this._candleListeners[candleId]) as [];
      const lastCandle = Coinray._tradesToLastCandle(resolution, trades);

      if (lastCandle) {
        this._candles[candleId] = Coinray._mergeCandle(this._candles[candleId], lastCandle);

        callbacks.map((callback: (payload: any) => void) => callback({
          coinraySymbol,
          resolution,
          candle: this._candles[candleId]
        }))
      }
    };

    const lastCandle = await this.fetchLastCandle({coinraySymbol, resolution});
    this._candles[candleId] = lastCandle || {time: 0};

    if (this._candleTradeListeners[coinraySymbol]) {
      this._candleTradeListeners[coinraySymbol][candleId] = candleCallback;
    } else {
      this._candleTradeListeners[coinraySymbol] = {[candleId]: candleCallback};
    }
    await this.subscribeTrades({coinraySymbol}, candleCallback);

    return callback
  }

  unsubscribeCandles({coinraySymbol, resolution}: CandleParam, callback?: (payload: any) => void) {
    const candleId = `${coinraySymbol}-${resolution}`;

    if (callback && this._candleListeners[candleId]) {
      this._candleListeners[candleId] = this._candleListeners[candleId].filter((c) => c !== callback)
    } else {
      this._candleListeners[candleId] = []
    }

    if (this._candleListeners[candleId].length === 0) {
      this.unsubscribeTrades({coinraySymbol}, this._candleTradeListeners[coinraySymbol][candleId]);
      delete this._candleTradeListeners[coinraySymbol][candleId];
    }
  }

  async fetchCandles({coinraySymbol, resolution, start, end}: CandlesParam): Promise<Candle[]> {
    const {result} = await this.get("candles", {
      version: "v1",
      params: {
        symbol: coinraySymbol,
        resolution: resolution,
        start_time: start,
        end_time: end
      }
    });

    return result.map(Coinray._parseCandle);
  }

  async fetchLastCandle({coinraySymbol, resolution}: CandleParam): Promise<Candle | undefined> {
    const {result} = await this.get("candles/latest", {
      version: "v1",
      params: {
        symbol: coinraySymbol,
        resolution: resolution,
      }
    });

    if (result.length > 0) {
      return Coinray._parseCandle(result[0])
    }
  }

  async fetchExchanges(): Promise<Array<Exchange>> {
    const {result: {exchanges}} = await this.get("exchanges", {
      version: "v1",
    });
    return exchanges.map((exhange) => Exchange.Create(exhange, this))
  }

  async fetchMarkets(exchange): Promise<Array<Market>> {
    const {result: {markets}} = await this.get("markets", {
      version: "v1",
      params: {
        exchange
      }
    });
    return markets.map((market) => {
      try {
        return Market.Create(market, this)
      } catch (error) {
        return new Market(market, this)
      }
    })
  }

  async fetchTrades(coinraySymbol): Promise<Trade[]> {
    const {result: trades} = await this.get("trades", {
      version: "v1",
      params: {
        symbol: coinraySymbol
      }
    });
    return trades.map(Coinray._parseTrade)
  }

  async fetchOrderBook(coinraySymbol): Promise<OrderBook> {
    const {result: {seq, asks, bids}} = await this.get("order_book", {
      version: "v1",
      params: {
        symbol: coinraySymbol
      }
    });

    return Coinray._parseOrderBook({seq, asks, bids})
  }

  async createCredential(deviceId: string, password: string) {
    const publicKey = await this.publicKey();

    try {
      const encryptedPassword = await encryptPayload(await createJWT({password}), publicKey);

      const {result} = await this.post("credentials", {
        secret: password,
        body: {
          deviceId, encryptedPassword
        }
      });

      return result
    } catch (error) {
      throw error
    }
  }

  async wrapApiKey(apiKeySettings: {}) {
    const publicKey = await this.publicKey();

    try {
      const apiKey = JSON.stringify(apiKeySettings);
      const encryptedApiKey = await encryptPayload(await createJWT({apiKey}), publicKey);

      const {result} = await this.post("credentials/wrap_api_key", {
        secret: this._sessionKey,
        body: {
          encryptedApiKey, credential: this._credential
        }
      });

      return result
    } catch (error) {
      throw error
    }
  }

  async createOrder(order: CreateOrderParams) {
    try {
      const {result} = await this.post("order", {
        secret: this._sessionKey,
        body: {...order, credential: this._credential}
      });
      return result
    } catch (error) {
      throw error
    }
  }

  async updateOrder(order: UpdateOrderParams) {
    try {
      const {result} = await this.patch("order", {
        secret: this._sessionKey,
        body: {...order, credential: this._credential}
      });
      return result
    } catch (error) {
      throw error
    }
  }

  async cancelOrder(order: CancelOrderParams) {
    try {
      const {result} = await this.delete("order", {
        secret: this._sessionKey,
        body: {...order, credential: this._credential}
      });
      return result
    } catch (error) {
      throw error
    }
  }

  async publicKey() {
    if (!this._publicKey) {
      const {result: {jwk}} = await this.get("credentials/certificate");
      this._publicKey = await JWK.asKey(jwk)
    }
    return this._publicKey
  }


  private get socket(): Socket {
    if (!this._token) {
      throw new Error("Token not present")
    }

    if (!this._socket) {
      this._socket = new Socket(this.config.websocketEndpoint, {
        transport: this._transport,
        reconnectAfterMs: (tries) => {
          if (jwtExpired(this._token)) {
            return 30000
          } else {
            return 1000
          }
        }
      });
    }
    // @ts-ignore
    this._socket.params = () => ({reconnect: true, token: this._token, client: "coinrayjs", version: VERSION});
    return this._socket
  }

  private getChannel(name: string): Channel {
    this.connect();

    if (this._channels[name]) {
      return this._channels[name]
    }

    const channel = this.socket.channel(name, {});
    this._channels[name] = channel;

    channel.join();

    return channel
  }

  async get(endpoint: string, {version = "v2", headers = {}, params = {}} = {}) {
    return await this._request(endpoint, "GET", {version, headers, params})
  }

  async post(endpoint: string, attributes) {
    return await this._request(endpoint, "POST", attributes)
  }

  async patch(endpoint: string, attributes) {
    return await this._request(endpoint, "PATCH", attributes)
  }

  async delete(endpoint: string, attributes) {
    return await this._request(endpoint, "delete", attributes)
  }

  private async _request(endpoint: string, method: Method, {version = "v2", headers = {}, params = {}, body = {}, secret = ""}) {
    const token = await this.getToken();

    const paramString = Object.entries(params).length > 0 ? '?' + Object.entries(params).map(([key, val]) => `${key}=${val}`).join('&') : "";
    const nonce = new Date().getTime();
    const requestUri = `/api/${version}/${endpoint}${paramString}`;

    if (version === "v2") {
      const dataToSign = [nonce, method.toUpperCase(), requestUri, JSON.stringify(body)].join("");
      const signature = signHMAC(dataToSign, secret);

      headers = {
        ...headers,
        "Cr-Access-Token": `${token}`,
        "Cr-Nonce": nonce,
        "Cr-Signature": signature
      }
    }

    const options = {
      method,
      url: this.config.apiEndpoint + requestUri,
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
        "Cr-Client-version": VERSION,
        ...headers
      },
      data: JSON.stringify(body)
    } as AxiosRequestConfig;

    try {
      const response = await axios(options);
      let result;
      if (response.status === 200) {
        result = response.data
      } else if (response.status === 204) {
        result = {}
      } else {
        result = response.data
      }
      return {result: camelize(result), _headers: response.headers}
    } catch ({response, request}) {
      const {error} = response.data;
      throw new CoinrayError(error)
    }
  }

  private static _parseOrderBookEntry([price, quantity]: any): OrderBookEntry {
    return {price: safeBigNumber(price), quantity: safeBigNumber(quantity)};
  }

  private static _parseOrderBook({asks, bids, seq}: any): OrderBook {
    return {
      seq,
      asks: asks.map(Coinray._parseOrderBookEntry) as OrderBookEntry[],
      bids: bids.map(Coinray._parseOrderBookEntry) as OrderBookEntry[],
    }
  }

  private static _parseCandle(result: any): Candle {
    if (result) {
      const [time, open, high, low, close, baseVolume, quoteVolume]: any = result;
      return {
        time: safeTime(time),
        open: safeBigNumber(open),
        high: safeBigNumber(high),
        low: safeBigNumber(low),
        close: safeBigNumber(close),
        baseVolume: safeBigNumber(baseVolume),
        quoteVolume: safeBigNumber(quoteVolume),
      }
    } else {
      throw new Error("Candle")
    }
  }

  private static _parseTrade([id, time, price, quantity, isBuy]: any): Trade {
    return {
      id,
      time: safeTime(time),
      price: safeBigNumber(price),
      quantity: safeBigNumber(quantity),
      type: ['1', 'buy'].includes(isBuy.toString()) ? "buy" : "sell"
    }
  }

  private static _tradesToLastCandle(resolution: string, trades: Trade[]): Candle {
    const seconds = Coinray._resolutionToSeconds(resolution);

    const currentTime = new Date().getTime();
    const startDate = new Date(currentTime - (currentTime % seconds));

    const currentCandleTrades = trades.filter((trade) => trade.time >= startDate);

    if (currentCandleTrades.length === 0) {
      return undefined
    }

    let first = currentCandleTrades[0];
    let open, low, high, close;
    let baseVolume = new BigNumber(0);
    let quoteVolume = new BigNumber(0);

    open = low = high = close = first.price;

    currentCandleTrades.map(({price, quantity}: Trade) => {
      low = BigNumber.min(low, price);
      high = BigNumber.max(high, price);
      close = price;
      baseVolume = baseVolume.plus(quantity);
      quoteVolume = quoteVolume.plus(quantity.multipliedBy(price));
    });

    return {
      time: new Date(startDate),
      open,
      high,
      low,
      close,
      baseVolume,
      quoteVolume,
    }
  };

  private static _mergeCandle(currentCandle: Candle, candle: Candle): Candle {
    if (currentCandle.time < candle.time) {
      return candle
    }

    currentCandle.high = BigNumber.max(currentCandle.high, candle.high);
    currentCandle.low = BigNumber.min(currentCandle.low, candle.low);
    currentCandle.close = candle.close;
    currentCandle.baseVolume = currentCandle.baseVolume.plus(candle.baseVolume);
    currentCandle.quoteVolume = currentCandle.quoteVolume.plus(candle.quoteVolume);

    return currentCandle
  }

  private static _resolutionToSeconds(resolution: string) {
    if (resolution.indexOf("W") > 0) {
      return parseInt(resolution) * 24 * 60 * 60 * 1000
    } else if (resolution.indexOf("D") > 0) {
      return parseInt(resolution) * 24 * 60 * 60 * 1000
    } else if (resolution === "D") {
      return 24 * 60 * 60 * 1000
    } else {
      return parseInt(resolution) * 60 * 1000
    }
  }
}
