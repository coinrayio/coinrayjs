import {Socket} from "phoenix";
import WebSocket from "ws";

const TIMEOUT = 10000;

export default class Coinray {
  constructor(url, opts, onMessage) {
    // construct a socket
    opts = opts || {};
    this.token = opts.token || 'UNSET_TOKEN';
    this.debug_mode = opts.debug || false;
    this.joined_symbols = {}

    opts.connect_on_construct = opts.connect_on_construct || true;
    if (opts.connect_on_construct === true) {
      this.connect(url)
    }
  }

  debug = (...args) => {
    if (this.debug_mode) {
      console.log.apply(this, args);
    }
  }

  connect = (url) => {
    this.debug("connecting to ", url, "with token (first 5 characters):", this.token.substring(0, 5));

    this.socket = new Socket(url, {
      transport: WebSocket,
      token: this.token,
      params: {token: this.token, client: "coinrayjs", version: VERSION}
    });
    this.socket.onOpen(event => this.debug("socket.onOpen: connected!"));
    this.socket.onError(event => this.debug("socket.onError: can't connect!", event.message));
    this.socket.onClose(event => this.debug("socket.onClose: disconnected!"));

    // open a connection to the server
    this.socket.connect();
  }

  disconnect = () => this.socket.disconnect();

  joinSymbol = (symbol, opts) => {
    this.debug("joinSymbol ", symbol, " ...");

    opts = opts || {};
    let chan = this.socket.channel(symbol, {trades: opts.trades});
    chan
      .join()
      .receive("ignore", () => this.debug(symbol, ": access denied"))
      .receive("ok", () => {
        this.debug(symbol, ": joined!")
        this.joined_symbols[symbol] = chan;
        if (opts.ok) {
          opts.ok(chan)
        }
      })
      .receive("timeout", () => this.debug(symbol, ": timeout"));

    // TODO let user configure these callbacks
    // chan.onError(event => console.log("Channel blew up.", event));
    // chan.onClose(event => console.log("Channel closed.", event));

    return chan;
  };

  subscribeTrades = (symbol, onUpdateTrades) => {
    this.joinSymbol(symbol, {
      ok: (chan) => {
        chan.on("update_trades", payload => onUpdateTrades && onUpdateTrades(payload));
        chan
          .push("subscribe_trades", {}, TIMEOUT)
          .receive("ok", msg => this.debug(`subscribed_trades for ${symbol} OK:`, msg));
      }
    })
  };

  unsubscribeTrades = (symbol) => {
    let chan = this.joined_symbols[symbol];
    if (chan) {
      this.debug(`unsubscribe_trades for ${symbol} ...`)
      chan.push("unsubscribe_trades", {}, TIMEOUT);
      delete this.joined_symbols[symbol];
    }
  };

  joinedSymbols = () => Object.keys(this.joined_symbols);

  // TODO orderbook, candles
}

module.exports = Coinray;
