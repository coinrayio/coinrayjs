import axios, { AxiosRequestConfig, Method } from "axios";
import { Channel, Socket } from "phoenix";
import { camelize, createJWT, encryptPayload, jwtExpired, MINUTES, signHMAC } from "./util";
import _ from "lodash"
import { Jose } from "jose-jwe-jws";

const VERSION = require('../package.json').version;

interface MarketParam {
  coinraySymbol: string
}

interface CandleParam {
  coinraySymbol: string,
  resolution: string
}

interface CandlesParam {
  coinraySymbol: string,
  resolution: string,
  start?: number,
  end?: number
}

interface Orderbook {
  seq: number,
  asks: [number, number],
  bids: [number, number],
}

interface Trade {
  id: string,
  time: Date,
  price: number,
  quantity: number,
  type: "sell" | "buy"
}

interface Candle {
  time: number,
  open: number,
  high: number,
  low: number,
  close: number,
  baseVolume: number,
  quoteVolume: number,
}

export class CoinrayError extends Error {
  errorCode: number;
  errorMessage: string;

  constructor({ code, message }) {
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
  private _onTokenExpired?: () => Promise<void>;
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
  private _connected: boolean = false;
  private _publicKey: any;
  _refreshingToken: Promise<void>;

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

  async checkToken() {
    if (jwtExpired(this._token) && this._onTokenExpired) {
      if (!this._refreshingToken) {
        this._refreshingToken = this._onTokenExpired();
      }
      await this._refreshingToken;
      return !jwtExpired(this._token);
    }
    return true;
  }

  setTransport(transport: any) {
    this._transport = transport
  }

  onTokenExpired(callback: () => Promise<void>) {
    this._onTokenExpired = callback;
    this._tokenCheckInterval = setInterval(this.checkToken, 5 * MINUTES)
  }

  refreshToken(token: string) {
    this._token = token
  }

  async getToken() {
    const tokenValid = await this.checkToken();
    if (tokenValid) {
      return this._token
    } else {
      throw new Error("Token is expired. call refreshToken in the onTokenExpired callback")
    }
  }

  disconnect() {
    if (this._socket) {
      this._socket.disconnect();
      this._socket = undefined
    }
    this._connected = false
  }

  async connect() {
    if (this._connected) {
      return
    }
    const token = await this.getToken();
    this._connected = true;

    this._socket = new Socket(this.config.websocketEndpoint, {
      transport: this._transport,
      params: { token: token, client: "coinrayjs", version: VERSION }
    });

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

    this.socket.connect()
  }

  onOpen(callback: (event: any) => void) {
    this._onOpen = callback
  }

  onError(callback: (event: any) => void) {
    this._onError = callback
  }

  async subscribeTrades({ coinraySymbol }: MarketParam, callback: (payload: any) => void) {
    if (this._tradeListeners[coinraySymbol] && this._tradeListeners[coinraySymbol].length > 0) {
      this._tradeListeners[coinraySymbol].push(callback);
      return callback
    }
    this._tradeListeners[coinraySymbol] = [callback];

    await this.connect();
    const channel = this.getChannel("trades");
    channel.on("update", ({ symbol, trades }) => {
      const callbacks = Object.values(this._tradeListeners[symbol]) as [];
      const parsedTrades = trades.map(Coinray._parseTrade);
      callbacks.map((callback: (payload: any) => void) => callback({
        coinraySymbol: symbol,
        type: "update",
        trades: parsedTrades
      }))
    });
    channel.on("snapshot", ({ symbol, trades }) => {
      const callbacks = Object.values(this._tradeListeners[symbol]) as [];
      const parsedTrades = trades.map(Coinray._parseTrade);
      callbacks.map((callback: (payload: any) => void) => callback({
        coinraySymbol: symbol,
        type: "snapshot",
        trades: parsedTrades
      }))
    });
    channel.on("error", (payload) => console.error(payload));
    channel.push("subscribe", { symbols: coinraySymbol, snapshots: true }, 5000);
    return callback
  }

  unsubscribeTrades({ coinraySymbol }: MarketParam, callback?: (payload: any) => void) {
    if (callback) {
      this._tradeListeners[coinraySymbol] = this._tradeListeners[coinraySymbol].filter((c: (payload: any) => void) => c !== callback)
    } else {
      this._tradeListeners[coinraySymbol] = []
    }

    if (this._tradeListeners[coinraySymbol].length === 0) {
      this.getChannel("trades")
        .push("unsubscribe", { symbols: coinraySymbol }, 5000)
    }
  }

  async subscribeOrderBook({ coinraySymbol }: MarketParam, callback: (payload: any) => void) {
    if (this._orderbookListeners[coinraySymbol] && this._orderbookListeners[coinraySymbol].length > 0) {
      this._orderbookListeners[coinraySymbol].push(callback);
      return callback
    }
    this._orderbookListeners[coinraySymbol] = [callback];

    await this.connect();
    const channel = this.getChannel("orderbooks");
    channel.on("update", ({ orderbooks }) => {
      const incoming_symbols = Object.keys(orderbooks);
      incoming_symbols.forEach(symbol => {
        const callbacks = Object.values(this._orderbookListeners[symbol]) as [];
        const parsedOrderbook = Coinray._parseOrderbook(orderbooks[symbol]);
        callbacks.map((callback: (payload: any) => void) => callback({
          coinraySymbol: symbol,
          type: "update",
          orderbook: parsedOrderbook
        }))
      })
    });
    channel.on("snapshot", ({ orderbooks }) => {
      const incoming_symbols = Object.keys(orderbooks);
      incoming_symbols.forEach(symbol => {
        const callbacks = Object.values(this._orderbookListeners[symbol]) as [];
        const parsedOrderbook = Coinray._parseOrderbook(orderbooks[symbol]);
        callbacks.map((callback: (payload: any) => void) => callback({
          coinraySymbol: symbol,
          type: "snapshot",
          orderbook: parsedOrderbook
        }))
      })
    });
    channel.on("error", (payload) => console.error(payload));
    channel.push("subscribe", { symbols: coinraySymbol }, 10000);
    return callback
  }

  unsubscribeOrderBook({ coinraySymbol }: MarketParam, callback?: (payload: any) => void) {
    if (callback) {
      this._orderbookListeners[coinraySymbol] = this._orderbookListeners[coinraySymbol].filter((c: (payload: any) => void) => c !== callback)
    } else {
      this._orderbookListeners[coinraySymbol] = []
    }

    if (this._orderbookListeners[coinraySymbol].length === 0) {
      this.getChannel("orderbooks")
        .push("unsubscribe", { symbols: coinraySymbol }, 5000)
    }
  }

  async subscribeCandles({ coinraySymbol, resolution }: CandleParam, callback: (payload: any) => void) {
    const candleId = `${coinraySymbol}-${resolution}`;

    if (this._candleListeners[candleId] && this._candleListeners[candleId].length > 0) {
      this._candleListeners[candleId].push(callback);
      return callback
    }
    this._candleListeners[candleId] = [callback];

    const lastCandle = await this.fetchLastCandle({ coinraySymbol, resolution });
    this._candles[candleId] = lastCandle || { time: 0 };

    const candleCallback = ({ coinraySymbol, trades }: any) => {
      const callbacks = Object.values(this._candleListeners[candleId]) as [];
      const candles = Coinray._tradesToCandle(resolution, trades);
      candles.map((candle) => {
        this._candles[candleId] = Coinray._mergeCandle(this._candles[candleId], candle)
      });

      callbacks.map((callback: (payload: any) => void) => callback({
        coinraySymbol: coinraySymbol,
        candle: this._candles[candleId]
      }))
    };

    if (this._candleTradeListeners[coinraySymbol]) {
      this._candleTradeListeners[coinraySymbol][candleId] = candleCallback;
    } else {
      this._candleTradeListeners[coinraySymbol] = { [candleId]: candleCallback };
    }
    await this.subscribeTrades({ coinraySymbol }, candleCallback);

    return callback
  }

  unsubscribeCandles({ coinraySymbol, resolution }: CandleParam, callback?: (payload: any) => void) {
    const candleId = `${coinraySymbol}-${resolution}`;

    if (callback && this._candleListeners[candleId]) {
      this._candleListeners[candleId] = this._candleListeners[candleId].filter((c: (payload: any) => void) => c !== callback)
    } else {
      this._candleListeners[candleId] = []
    }

    if (this._candleListeners[candleId].length === 0) {
      this.unsubscribeTrades({ coinraySymbol }, this._candleTradeListeners[coinraySymbol][candleId]);
      delete this._candleTradeListeners[coinraySymbol][candleId];
    }
  }

  async fetchCandles({ coinraySymbol, resolution, start, end }: CandlesParam): Promise<Candle[]> {
    const { result } = await this.get("candles", {
      version: "v1",
      params: {
        symbol: coinraySymbol,
        resolution: resolution,
        startTime: start,
        endTime: end
      }
    });

    return result.map(Coinray._parseCandle);
  }

  async fetchLastCandle({ coinraySymbol, resolution }: CandleParam): Promise<Candle | undefined> {
    const { result } = await this.get("candles/latest", {
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

  async createCredential(deviceId: string, password: string) {
    const publicKey = await this.publicKey();

    try {
      const encryptedPassword = await encryptPayload(await createJWT({ password }), publicKey);

      const { result } = await this.post("credentials", {
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
      const encryptedApiKey = await encryptPayload(await createJWT({ apiKey }), publicKey);

      const { result } = await this.post("credentials/wrap_api_key", {
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

  async publicKey() {
    if (!this._publicKey) {
      const { result: { jwk } } = await this.get("credentials/certificate");
      this._publicKey = Jose.Utils.importRsaPublicKey(jwk, "RSA-OAEP");
    }
    return this._publicKey
  }


  private get socket(): Socket {
    if (!this._socket) {
      throw new Error("Socket not present")
    }
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

  async get(endpoint: string, { version = "v2", headers = {}, params = {} } = {}) {
    return await this._request(endpoint, "GET", { version, headers, params })
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

  private async _request(endpoint: string, method: Method, { version = "v2", headers = {}, params = {}, body = {}, secret = "" }) {
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
      return { result: camelize(result), _headers: response.headers }
    } catch ({ response, request }) {
      const { error } = response.data;
      throw new CoinrayError(error)
    }
  }

  private static _parseOrderbookEntry([price, quantity]: any): [number, number] {
    return [parseFloat(price), parseFloat(quantity)];
  }

  private static _parseOrderbook({ asks, bids, seq }: any): Orderbook {
    return {
      seq,
      asks: asks.map(Coinray._parseOrderbookEntry),
      bids: bids.map(Coinray._parseOrderbookEntry),
    }
  }

  private static _parseCandle(result: any): Candle {
    if (result) {
      const [time, open, high, low, close, baseVolume, quoteVolume]: any = result;
      return {
        time,
        open: parseFloat(open),
        high: parseFloat(high),
        low: parseFloat(low),
        close: parseFloat(close),
        baseVolume: parseFloat(baseVolume),
        quoteVolume: parseFloat(quoteVolume),
      }
    } else {
      throw new Error("Candle")
    }
  }

  private static _parseTrade([id, time, price, quantity, isBuy]: any): Trade {
    return {
      id,
      time: new Date(time),
      price: parseFloat(price),
      quantity: parseFloat(quantity),
      type: isBuy === 1 ? "buy" : "sell"
    }
  }

  private static _tradesToCandle(resolution: string, trades: Trade[]): Candle[] {
    const seconds = Coinray._resolutionToSeconds(resolution);

    const groupedTrades = _.groupBy(trades, (trade: Trade) => {
      const unix = Math.floor(trade.time.getTime());
      return unix - (unix % seconds)
    });

    const candles: Candle[] = [];
    _.forEach(groupedTrades, (trades, time) => {
      let first = trades[0];
      let open, low: number, high: number, close;
      let baseVolume = 0;
      let quoteVolume = 0;

      open = low = high = close = first.price;

      trades.map(({ price, quantity }: Trade) => {
        low = Math.min(low, price);
        high = Math.max(high, price);
        close = price;
        baseVolume += quantity;
        quoteVolume += quantity * price;
      });

      candles.push({
        time: parseInt(time),
        open,
        high,
        low,
        close,
        baseVolume,
        quoteVolume,
      })
    });
    return candles
  };

  private static _mergeCandle(currentCandle: Candle, candle: Candle): Candle {
    if (currentCandle.time !== candle.time) {
      return candle
    }

    currentCandle.high = Math.max(currentCandle.high, candle.high);
    currentCandle.low = Math.min(currentCandle.low, candle.low);
    currentCandle.close = candle.close;
    currentCandle.baseVolume += candle.baseVolume;
    currentCandle.quoteVolume += candle.quoteVolume;

    return currentCandle
  }

  private static _resolutionToSeconds(resolution: string) {
    if (resolution.indexOf("W") > 0) {
      return parseInt(resolution) * 24 * 60 * 60 * 1000
    } else if (resolution.indexOf("D") > 0) {
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
