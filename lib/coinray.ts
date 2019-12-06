import axios, {AxiosRequestConfig} from "axios";
import {Channel, Socket} from "phoenix";
import {jwtExpired, MINUTES} from "./util";
import _ from "lodash"

const API_ENDPOINT = "https://coinray.io/";
const WS_ENDPOINT = "wss://ws.coinray.io/v1";

const VERSION = "0.0.1";

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

export default class Coinray {
  private _token: string;
  private _onTokenExpired?: () => void;
  private _tokenCheckInterval: any;
  private _onError?: (event: any) => void;
  private _onOpen?: (event: any) => void;
  private _socket?: Socket;
  private _transport: any;

  private _tradeListeners: any = {};

  private _candleTradeListeners: any = {};
  private _candleListeners: any = {};
  private _candles: any = {};

  private _channels: any = {};
  private _connected: boolean = false;

  constructor(token: string) {
    this._token = token;
  }

  destroy() {
    this._tradeListeners = {};
    this._channels = {};

    if (this._tokenCheckInterval) {
      clearInterval(this._tokenCheckInterval)
    }
    this.disconnect()
  }

  checkToken() {
    if (jwtExpired(this._token) && this._onTokenExpired) {
      this._onTokenExpired();
      return false
    }
    return true;
  }

  setTransport(transport: any) {
    this._transport = transport
  }

  onTokenExpired(callback: () => void) {
    this._onTokenExpired = callback;
    this._tokenCheckInterval = setInterval(this.checkToken, 5 * MINUTES)
  }

  refreshToken(token: string) {
    this._token = token
  }

  disconnect() {
    if (this._socket) {
      this._socket.disconnect();
      this._socket = undefined
    }
    this._connected = false
  }

  connect() {
    if (this._connected) {
      return
    }
    this._connected = true;

    this._socket = new Socket(WS_ENDPOINT, {
      transport: this._transport,
      params: {token: this._token, client: "coinrayjs", version: VERSION}
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

  subscribeTrades({coinraySymbol}: MarketParam, callback: (payload: any) => void) {
    if (this._tradeListeners[coinraySymbol] && this._tradeListeners[coinraySymbol].length > 0) {
      this._tradeListeners[coinraySymbol].push(callback);
      return callback
    }
    this._tradeListeners[coinraySymbol] = [callback];

    this.connect();
    const channel = this.getChannel("trades");

    channel.push("subscribe", {symbols: coinraySymbol}, 5000);
    channel.on("update", ({symbol, trades}) => {
      const callbacks = Object.values(this._tradeListeners[symbol]) as [];
      callbacks.map((callback: (payload: any) => void) => callback({
        coinraySymbol: symbol,
        trades: trades.map(Coinray._parseTrade)
      }))
    });

    return callback
  }

  unsubscribeTrades({coinraySymbol}: MarketParam, callback?: (payload: any) => void) {
    if (callback) {
      this._tradeListeners[coinraySymbol] = this._tradeListeners[coinraySymbol].filter((c: (payload: any) => void) => c !== callback)
    } else {
      this._tradeListeners[coinraySymbol] = []
    }

    if (this._tradeListeners[coinraySymbol].length === 0) {
      console.log("all done closing trades");
      this.getChannel("trades")
          .push("unsubscribe", {symbols: coinraySymbol}, 5000)
    }
  }

  subscribeOrderBook({coinraySymbol}: MarketParam, callback: () => void) {

  }

  unsubscribeOrderBook(handle: string) {

  }

  subscribeCandles({coinraySymbol, resolution}: CandleParam, callback: (payload: any) => void) {
    const candleId = `${coinraySymbol}-${resolution}`;

    if (this._candleListeners[candleId] && this._candleListeners[candleId].length > 0) {
      this._candleListeners[candleId].push(callback);
      return callback
    }

    this._candleListeners[candleId] = [callback];
    this._candles[candleId] = this._candles[candleId] || {
      time: 0,
    };

    const candleCallback = ({coinraySymbol, trades}: any) => {
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
      this.subscribeTrades({coinraySymbol}, candleCallback);
      return callback
    }
    this._candleTradeListeners[coinraySymbol] = {[candleId]: candleCallback};
    this.subscribeTrades({coinraySymbol}, candleCallback);

    return callback
  }

  unsubscribeCandles({coinraySymbol, resolution}: CandleParam, callback?: (payload: any) => void) {
    const candleId = `${coinraySymbol}-${resolution}`;

    if (callback && this._candleListeners[candleId]) {
      this._candleListeners[candleId] = this._candleListeners[candleId].filter((c: (payload: any) => void) => c !== callback)
    } else {
      this._candleListeners[candleId] = []
    }

    if (this._candleListeners[candleId].length === 0) {
      this.unsubscribeTrades({coinraySymbol}, this._candleTradeListeners[coinraySymbol][candleId]);
      delete this._candleTradeListeners[coinraySymbol][candleId];
    }
  }

  async fetchCandles({coinraySymbol, resolution, start, end}: CandlesParam): Promise<Candle[]> {
    const {result} = await this._request("candles", {
      symbol: coinraySymbol,
      resolution: resolution,
      startTime: start,
      endTime: end
    });

    return result.map(Coinray._parseCandle);
  }

  async fetchLastCandle({coinraySymbol, resolution}: CandleParam): Promise<Candle> {
    const {result} = await this._request("candles/latest", {
      symbol: coinraySymbol,
      resolution: resolution,
    });

    return Coinray._parseCandle(result[0])
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

  private async _request(endpoint: string, params: any) {
    const paramString = Object.entries(params).map(([key, val]) => `${key}=${val}`).join('&');

    const options = {
      method: "GET",
      url: API_ENDPOINT + `/api/v1/${endpoint}?${paramString}`,
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "Authorization": `Bearer ${this._token}`
      },
    } as AxiosRequestConfig;

    try {
      const response = await axios(options);
      let result;
      if (response.status === 200) {
        result = response.data
      } else if (response.status === 204) {
        result = {}
      }
      return {result, _headers: response.headers}
    } catch ({response}) {
      throw new Error(response)
    }
  }

  private static _parseCandle([time, open, high, low, close, baseVolume, quoteVolume]: any): Candle {
    return {
      time,
      open: parseFloat(open),
      high: parseFloat(high),
      low: parseFloat(low),
      close: parseFloat(close),
      baseVolume: parseFloat(baseVolume),
      quoteVolume: parseFloat(quoteVolume),
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

      trades.map(({price, quantity}: Trade) => {
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
