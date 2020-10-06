import axios, {AxiosRequestConfig, Method} from "axios";
import {Channel, Socket} from "phoenix";
import {
  camelize,
  createJWT,
  encryptPayload,
  jwkToPublicKey,
  jwtExpired,
  parseJWT,
  safeBigNumber,
  safeTime,
  signHMAC
} from "./util";

import {
  Balance,
  CancelOrderParams,
  Candle,
  CandleParam,
  CandlesParam,
  CreateOrderParams,
  MarketParam,
  OrderBook,
  OrderBookSide,
  SmartOrderParams,
  Trade,
  UpdateOrderParams,
} from "./types";
import Market from "./market";
import Exchange from "./exchange";
import BigNumber from "bignumber.js";
import _ from "lodash";
import I18n from "./i18n";

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
  static I18n = I18n

  config: {
    apiEndpoint: string;
    orderEndpoint: string;
    websocketEndpoint: string;
  };
  private _token: string;
  private _sessionKey: string;
  private _credential: string;
  private _firstOpen: boolean;
  private _onTokenExpired?: () => Promise<string>;
  private _tokenCheckInterval: any;
  private _onError?: (event: any) => void;
  private _onOpen?: (event: any) => void;
  private _socket?: Socket;
  private _transport: any;

  private _tradeListeners: any = {};
  private _tradeSnapshots: any = {};
  private _orderbookListeners: any = {};
  private _orderbookSnapshots: any = {};

  private _candleTradeListeners: any = {};
  private _candleListeners: any = {};
  private _candles: any = {};

  private _channels: any = {};
  private _connected: Promise<boolean>;
  private markConnected: any;
  private _publicKey: any;
  _refreshingToken: Promise<string>;
  private onReconnect: any;
  private _nonceOffset: number;
  private tradesSubscribed: boolean = false;
  private orderBookSubscribed: boolean = false;
  private _timeOffset: number;
  private _timeOffsetInterval: any;

  constructor(token: string, {apiEndpoint, orderEndpoint, websocketEndpoint} =
      {
        apiEndpoint: "https://coinray.io",
        orderEndpoint: "https://coinray.io",
        websocketEndpoint: "wss://ws.coinray.io/v1",
      }) {
    this._token = token;
    this._nonceOffset = 0;
    this._timeOffset = 0;
    this._firstOpen = true;
    this.config = {
      apiEndpoint: apiEndpoint || "https://coinray.io",
      orderEndpoint: orderEndpoint || apiEndpoint || "https://coinray.io",
      websocketEndpoint: websocketEndpoint || "wss://ws.coinray.io/v1"
    };

    this.loadTimeOffset().then();
    this._timeOffsetInterval = setInterval(this.loadTimeOffset, 60 * 1000)
    console.log(Coinray.I18n.t("testkey"))
  }

  authenticateDevice = (credential: string, sessionKey: string) => {
    this._credential = credential;
    this._sessionKey = sessionKey;
  };

  destroy = () => {
    this._tradeListeners = {};
    this._channels = {};

    if (this._timeOffsetInterval) {
      clearInterval(this._timeOffsetInterval)
    }
    if (this._tokenCheckInterval) {
      clearInterval(this._tokenCheckInterval)
    }
    this.disconnect()
  };

  checkToken = async () => {
    if (jwtExpired(this._token)) {
      console.log("Coinray token expired. Can refresh:", !!this._onTokenExpired);
      if (!this._onTokenExpired) {
        return false
      }
      if (!this._refreshingToken) {
        this._refreshingToken = this._onTokenExpired();
      }
      try {
        this._token = await this._refreshingToken;
      } catch (error) {
        console.log("Coinray token could not be refreshed", error);
        this._refreshingToken = undefined;
        return false
      }
      this._refreshingToken = undefined;
      if (!jwtExpired(this._token)) {
        this.reconnect()
      } else {
        return false
      }
    }
    return true;
  };

  setTransport = (transport: any) => {
    this._transport = transport
  };

  onTokenExpired = (callback: () => Promise<string>) => {
    this._onTokenExpired = callback;
    this._tokenCheckInterval = setInterval(this.checkToken, 5000);
  };

  refreshToken = (token: string) => {
    this._token = token;
  };

  getNonce = () => {
    if (this._nonceOffset > 900) {
      this._nonceOffset = 0
    }
    this._nonceOffset += 1;
    return this.getTime() + this._nonceOffset
  };

  getTime = () => {
    return Math.floor(new Date().getTime() / 1000) * 1000 + this._timeOffset;
  };

  loadTimeOffset = async () => {
    const {result} = await this.get("/coinray/time");
    this._timeOffset = result.time - new Date().getTime();
  };

  getToken = async () => {
    const tokenValid = await this.checkToken();
    if (tokenValid) {
      return this._token
    } else {
      throw new Error("Token is expired. call refreshToken in the onTokenExpired callback")
    }
  };

  reconnect = () => {
    if (this._connected) {
      // @ts-ignore
      this.socket.conn.close();
    }
  };

  disconnect = () => {
    if (this._socket) {
      this._socket.disconnect();
      this._socket = undefined
    }
    this._connected = undefined
  };

  connect = async () => {
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
  };

  onOpen = (callback: (event: any) => void) => {
    this._onOpen = callback
  };

  onError = (callback: (event: any) => void) => {
    this._onError = callback
  };

  resubscribe = () => {
    if (this._firstOpen) {
      this._firstOpen = false
      return
    }

    Object.keys(this._tradeListeners).forEach((coinraySymbol) => {
      const channel = this.getChannel("trades");
      channel.push("subscribe", {symbols: coinraySymbol, snapshots: true}, 5000);
    });
    Object.keys(this._orderbookListeners).forEach((coinraySymbol) => {
      const channel = this.getChannel("orderbooks");
      channel.push("subscribe", {symbols: coinraySymbol, snapshots: true}, 5000);
    });
  }

  subscribeTrades = async ({coinraySymbol}: MarketParam, callback: (payload: any) => void) => {
    if (this._tradeListeners[coinraySymbol] && this._tradeListeners[coinraySymbol].length > 0) {
      this._tradeListeners[coinraySymbol].push(callback);

      callback({
        type: "trades:snapshot",
        coinraySymbol: coinraySymbol,
        trades: this._tradeSnapshots[coinraySymbol]
      })
      return callback
    }
    this._tradeSnapshots[coinraySymbol] = []
    this._tradeListeners[coinraySymbol] = [callback];

    await this.connect();
    const channel = this.getChannel("trades");
    channel.push("subscribe", {symbols: coinraySymbol, snapshots: true}, 5000);

    if (this.tradesSubscribed) {
      return callback
    }
    this.tradesSubscribed = true;

    channel.on("snapshot", ({symbol, trades}) => {
      const callbacks = Object.values(this._tradeListeners[symbol]) as [];
      const parsedTrades = trades.map(Coinray._parseTrade);
      this._tradeSnapshots[symbol] = parsedTrades

      callbacks.map((callback: (payload: any) => void) => callback({
        type: "trades:snapshot",
        coinraySymbol: symbol,
        trades: parsedTrades
      }))
    });
    channel.on("update", ({symbol, trades}) => {
      const callbacks = Object.values(this._tradeListeners[symbol]) as [];
      const parsedTrades = trades.map(Coinray._parseTrade);
      this._tradeSnapshots[symbol] = [...parsedTrades, ...this._tradeSnapshots[symbol]].slice(0, 100);
      callbacks.map((callback: (payload: any) => void) => callback({
        type: "trades:update",
        coinraySymbol: symbol,
        trades: parsedTrades
      }))
    });
    channel.on("error", (payload) => console.error(payload));

    return callback
  };

  unsubscribeTrades = ({coinraySymbol}: MarketParam, callback?: (payload: any) => void) => {
    if (callback && this._tradeListeners[coinraySymbol]) {
      this._tradeListeners[coinraySymbol] = this._tradeListeners[coinraySymbol].filter((c: (payload: any) => void) => c !== callback);

      if (this._tradeListeners[coinraySymbol].length === 0) {
        this.getChannel("trades")
            .push("unsubscribe", {symbols: coinraySymbol}, 5000)
      }
    } else {
      this._tradeSnapshots[coinraySymbol] = []
      this._tradeListeners[coinraySymbol] = []
    }
  };

  subscribeOrderBook = async ({coinraySymbol}: MarketParam, callback: (payload: any) => void) => {
    if (this._orderbookListeners[coinraySymbol] && this._orderbookListeners[coinraySymbol].length > 0) {
      this._orderbookListeners[coinraySymbol].push(callback);

      callback({
        type: "orderBook:snapshot",
        coinraySymbol: coinraySymbol,
        orderBook: this._orderbookSnapshots[coinraySymbol]
      })
      return callback
    }
    this._orderbookSnapshots[coinraySymbol] = {minSeq: 0, maxSeq: 0, bids: {}, asks: {}};
    this._orderbookListeners[coinraySymbol] = [callback];

    await this.connect();
    const channel = this.getChannel("orderbooks");
    channel.push("subscribe", {symbols: coinraySymbol}, 10000);

    if (this.orderBookSubscribed) {
      return callback
    }
    this.orderBookSubscribed = true;

    channel.on("snapshot", ({orderbooks}) => {
      const incoming_symbols = Object.keys(orderbooks);
      incoming_symbols.forEach(symbol => {
        const callbacks = Object.values(this._orderbookListeners[symbol]) as [];
        const parsedOrderBook = Coinray._parseOrderBookSnapshot(orderbooks[symbol]);
        this._orderbookSnapshots[symbol] = parsedOrderBook
        callbacks.map((callback: (payload: any) => void) => callback({
          type: "orderBook:snapshot",
          coinraySymbol: symbol,
          orderBook: parsedOrderBook
        }))
      })
    });
    channel.on("update", ({orderbooks}) => {
      const incoming_symbols = Object.keys(orderbooks);
      if (incoming_symbols.length === 0) {
        return
      }

      incoming_symbols.forEach(symbol => {
        const callbacks = Object.values(this._orderbookListeners[symbol]) as [];
        const parsedOrderBook = Coinray._parseOrderBookUpdate(orderbooks[symbol]);

        this._orderbookSnapshots[symbol] = Coinray._updateOrderBook(this._orderbookSnapshots[symbol], parsedOrderBook);

        callbacks.map((callback: (payload: any) => void) => callback({
          type: "orderBook:update",
          coinraySymbol: symbol,
          orderBook: parsedOrderBook
        }))
      })
    });
    channel.on("error", (payload) => console.error(payload));

    return callback
  };

  unsubscribeOrderBook = ({coinraySymbol}: MarketParam, callback?: (payload: any) => void) => {
    if (callback && this._orderbookListeners[coinraySymbol]) {
      this._orderbookListeners[coinraySymbol] = this._orderbookListeners[coinraySymbol].filter((c: (payload: any) => void) => c !== callback);

      if (this._orderbookListeners[coinraySymbol].length === 0) {
        this.getChannel("orderbooks")
            .push("unsubscribe", {symbols: coinraySymbol}, 5000)
      }
    } else {
      this._orderbookSnapshots[coinraySymbol] = {minSeq: 0, maxSeq: 0, bids: {}, asks: {}}
      this._orderbookListeners[coinraySymbol] = []
    }
  };

  subscribeCandles = async ({coinraySymbol, resolution}: CandleParam, callback: (payload: any) => void) => {
    const candleId = `${coinraySymbol}-${resolution}`;

    if (this._candleListeners[candleId] && this._candleListeners[candleId].length > 0) {
      this._candleListeners[candleId].push(callback);
      return callback
    }
    this._candleListeners[candleId] = [callback];

    const candleCallback = ({type, coinraySymbol, trades}: any) => {
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

    if (this._candleTradeListeners[coinraySymbol]) {
      this._candleTradeListeners[coinraySymbol][candleId] = candleCallback;
    } else {
      this._candleTradeListeners[coinraySymbol] = {[candleId]: candleCallback};
    }

    const lastCandle = await this.fetchLastCandle({coinraySymbol, resolution});
    this._candles[candleId] = lastCandle || {time: 0};
    await this.subscribeTrades({coinraySymbol}, candleCallback);

    return callback
  };

  unsubscribeCandles = ({coinraySymbol, resolution}: CandleParam, callback?: (payload: any) => void) => {
    const candleId = `${coinraySymbol}-${resolution}`;

    if (callback && this._candleListeners[candleId]) {
      this._candleListeners[candleId] = this._candleListeners[candleId].filter((c) => c !== callback)
    } else {
      this._candleListeners[candleId] = []
    }

    if (this._candleListeners[candleId].length === 0) {
      this.unsubscribeTrades({coinraySymbol}, this._candleTradeListeners[coinraySymbol][candleId]);
      delete this._candles[candleId];
      delete this._candleTradeListeners[coinraySymbol][candleId];
    }
  };

  fetchCandles = async ({coinraySymbol, resolution, start, end}: CandlesParam): Promise<Candle[]> => {
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
  };

  fetchLastCandle = async ({coinraySymbol, resolution}: CandleParam): Promise<Candle | undefined> => {
    const {result} = await this.get("candles/latest", {
      version: "v1",
      params: {
        symbol: coinraySymbol,
        resolution: resolution,
      }
    });

    if (result.length > 0) {
      const candle = Coinray._parseCandle(result[0])
      candle.skipVolume = true // Mark the candle to skip adding the volume on the first run
      return candle
    }
  };

  fetchExchanges = async (): Promise<Array<Exchange>> => {
    const {result: {exchanges}} = await this.get("exchanges", {
      version: "v1",
    });
    return exchanges.map((exhange) => Exchange.Create(exhange, this))
  };

  fetchMarkets = async (exchange): Promise<Array<Market>> => {
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
  };

  fetchTrades = async (coinraySymbol): Promise<Trade[]> => {
    const {result: trades} = await this.get("trades", {
      version: "v1",
      params: {
        symbol: coinraySymbol
      }
    });
    return trades.map(Coinray._parseTrade)
  };

  fetchOrderBook = async (coinraySymbol): Promise<OrderBook> => {
    const {result: {seq, asks, bids}} = await this.get("order_book", {
      version: "v1",
      params: {
        symbol: coinraySymbol
      }
    });

    return Coinray._parseOrderBookSnapshot({seq, asks, bids});
  };

  createCredential = async (deviceId: string, password: string) => {
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
  };

  wrapApiKey = async (apiKeySettings: {}) => {
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
  };

  createSmartOrderSignature = async (smartOrder: SmartOrderParams) => {
    try {
      const {result} = await this.post("order/smart_order_signature", {
        secret: this._sessionKey,
        apiEndpoint: this.config.orderEndpoint,
        body: {smartOrder, credential: this._credential}
      });
      return result
    } catch (error) {
      throw error
    }
  }

  createOrder = async (order: CreateOrderParams) => {
    try {
      const {result} = await this.post("order", {
        secret: this._sessionKey,
        apiEndpoint: this.config.orderEndpoint,
        body: {...order, credential: this._credential}
      });
      return result
    } catch (error) {
      throw error
    }
  };

  updateOrder = async (order: UpdateOrderParams) => {
    try {
      const {result} = await this.patch("order", {
        secret: this._sessionKey,
        apiEndpoint: this.config.orderEndpoint,
        body: {...order, credential: this._credential}
      });
      return result
    } catch (error) {
      throw error
    }
  };

  cancelOrder = async (order: CancelOrderParams) => {
    try {
      const {result} = await this.delete("order", {
        secret: this._sessionKey,
        apiEndpoint: this.config.orderEndpoint,
        body: {...order, credential: this._credential}
      });
      return result
    } catch (error) {
      throw error
    }
  };

  createWebSocketToken = async ({exchangeCode, encryptedApiKey}) => {
    try {
      const {result} = await this.post("exchanges/ws_token", {
        secret: this._sessionKey,
        apiEndpoint: this.config.orderEndpoint,
        body: {encryptedApiKey, exchangeCode, credential: this._credential}
      });
      return result
    } catch (error) {
      throw error
    }
  };

  fetchPositions = async ({exchangeCode, encryptedApiKey}) => {
    try {
      const {result} = await this.get("futures/positions", {
        secret: this._sessionKey,
        apiEndpoint: this.config.orderEndpoint,
        params: {
          credential: this._credential,
          exchangeCode,
          encryptedApiKey
        }
      });
      return result
    } catch (error) {
      throw error
    }
  };

  getBalances = async ({exchangeCode, encryptedApiKey}) => {
    try {
      const {result: {balances, positions}} = await this.get("account/balances", {
        secret: this._sessionKey,
        apiEndpoint: this.config.orderEndpoint,
        params: {
          credential: this._credential,
          exchangeCode,
          encryptedApiKey
        }
      });
      return {balances: balances.map(Coinray._parseBalance), positions}
    } catch (error) {
      throw error
    }
  };

  setLeverage = async ({coinraySymbol, leverage, encryptedApiKey}) => {
    try {
      const {result} = await this.post("futures/leverage", {
        secret: this._sessionKey,
        apiEndpoint: this.config.orderEndpoint,
        body: {
          credential: this._credential,
          coinraySymbol,
          leverage,
          encryptedApiKey
        }
      });
      return result
    } catch (error) {
      throw error
    }
  };

  setMarginType = async ({coinraySymbol, marginType, encryptedApiKey}) => {
    try {
      const {result} = await this.post("futures/margin_type", {
        secret: this._sessionKey,
        apiEndpoint: this.config.orderEndpoint,
        body: {
          credential: this._credential,
          coinraySymbol,
          marginType,
          encryptedApiKey
        }
      });
      return result
    } catch (error) {
      throw error
    }
  };

  async publicKey() {
    if (!this._publicKey) {
      const {result: {jwk}} = await this.get("credentials/certificate");
      this._publicKey = await jwkToPublicKey(jwk)
    }
    return this._publicKey
  }

  get clientId(): string {
    return parseJWT(this._token).header.kid
  }


  private get socket(): Socket {
    if (!this._token) {
      throw new Error("Token not present")
    }

    if (!this._socket) {
      this._socket = new Socket(this.config.websocketEndpoint, {
        heartbeatIntervalMs: 5000,
        transport: this._transport,
        reconnectAfterMs: (tries) => {
          if (jwtExpired(this._token)) {
            return 30000
          } else {
            return 1000
          }
        }
      });
      this.onOpen(this.resubscribe)
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

  get = async (endpoint: string, {apiEndpoint = undefined, version = "v2", headers = {}, params = {}, secret = ""} = {}) => await this._request(endpoint, "GET", {
    version,
    apiEndpoint,
    headers,
    secret,
    params
  });

  post = async (endpoint: string, attributes) => await this._request(endpoint, "POST", attributes);

  patch = async (endpoint: string, attributes) => await this._request(endpoint, "PATCH", attributes);

  delete = async (endpoint: string, attributes) => await this._request(endpoint, "delete", attributes);

  private async _request(endpoint: string, method: Method, {apiEndpoint, version = "v2", headers = {}, params = {}, body = {}, secret = ""}) {
    const token = await this.getToken();

    const paramString = Object.entries(params).length > 0 ? '?' + Object.entries(params).map(([key, val]) => val ? `${key}=${val}` : undefined).filter(Boolean).join('&') : "";
    const nonce = this.getNonce();
    const requestUri = `/api/${version}/${endpoint}${paramString}`;

    if (version === "v2") {
      const dataToSign = [nonce, method.toUpperCase(), requestUri, method === "GET" ? "" : JSON.stringify(body)].join("");
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
      url: (apiEndpoint || this.config.apiEndpoint) + requestUri,
      timeout: 20000,
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
        "Cr-Client-version": VERSION,
        ...headers
      },
      data: method === "GET" ? undefined : JSON.stringify(body)
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
    } catch (error) {
      const {response, request} = error;
      if (response) {
        const {error} = response.data;
        throw new CoinrayError(error)
      } else {
        throw error
      }
    }
  }

  private static _parseOrderBookSnapshot({asks, bids, min_seq, max_seq}: any): OrderBook {
    return {
      minSeq: min_seq,
      maxSeq: max_seq,
      asks: Coinray._parseBidAsk(asks),
      bids: Coinray._parseBidAsk(bids),
    }
  }

  private static _parseOrderBookUpdate({asks_diff, bids_diff, min_seq, max_seq}: any): OrderBook {
    return {
      minSeq: min_seq,
      maxSeq: max_seq,
      asks: Coinray._parseBidAsk(asks_diff),
      bids: Coinray._parseBidAsk(bids_diff),
    }
  }

  private static _updateOrderBook(orderBook, {asks, bids, min_seq, max_seq}: any) {
    const update = (side, updates: OrderBookSide) => {
      _.forEach(updates, (quantity, price) => {
        if (quantity.gt(0)) {
          side[price] = quantity
        } else {
          delete side[price]
        }
      })
    };

    orderBook.minSeq = min_seq
    orderBook.maxSeq = max_seq
    update(orderBook.bids, bids);
    update(orderBook.asks, asks);

    return orderBook
  }

  private static _parseBidAsk(bidAsk) {
    if (Array.isArray(bidAsk)) {
      return bidAsk.reduce((acc, [price, quantity]) => {
        acc[price] = new BigNumber(quantity);
        return acc
      }, {});
    } else {
      return Object.keys(bidAsk).reduce((acc, price) => {
        acc[price] = new BigNumber(bidAsk[price]);
        return acc
      }, {});
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

  private static _parseBalance(balance): Balance {
    let newBalance = {
      currency: balance.currency,
      available: safeBigNumber(balance.available),
      inOrders: safeBigNumber(balance.inOrders),
      total: safeBigNumber(balance.inOrders),
    }

    if (balance.initialMargin) {
      newBalance = {
        ...newBalance,
        ...{
          initialMargin: safeBigNumber(balance.initialMargin),
          openOrderInitialMargin: safeBigNumber(balance.openOrderInitialMargin),
          positionInitialMargin: safeBigNumber(balance.positionInitialMargin),
          unrealizedProfit: safeBigNumber(balance.unrealizedProfit),
          crossWalletBalance: safeBigNumber(balance.crossWalletBalance),
          crossUnrealizedProfit: safeBigNumber(balance.crossUnrealizedProfit),
        }
      }
    }
    return newBalance
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

    currentCandleTrades.reverse().map(({price, quantity}: Trade) => {
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
    if (currentCandle.skipVolume) {
      currentCandle.skipVolume = false
    } else {
      currentCandle.baseVolume = currentCandle.baseVolume.plus(candle.baseVolume);
      currentCandle.quoteVolume = currentCandle.quoteVolume.plus(candle.quoteVolume);
    }

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
