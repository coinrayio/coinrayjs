"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _phoenix = require("phoenix");

var _ws = _interopRequireDefault(require("ws"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

var TIMEOUT = 10000;
var COINRAYJS_VERSION = "0.0.16";

var Coinray = function Coinray(_url, _opts, onMessage) {
  var _this = this;

  _classCallCheck(this, Coinray);

  _defineProperty(this, "debug", function () {
    if (_this.debug_mode) {
      for (var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++) {
        args[_key] = arguments[_key];
      }

      console.log.apply(_this, args);
    }
  });

  _defineProperty(this, "connect", function (url) {
    _this.debug("connecting to ", url, "with token (first 5 characters):", _this.token.substring(0, 5));

    _this.socket = new _phoenix.Socket(url, {
      transport: _ws.default,
      token: _this.token,
      params: {
        token: _this.token,
        client: "coinrayjs",
        version: COINRAYJS_VERSION
      }
    });

    _this.socket.onOpen(function (event) {
      return _this.debug("socket.onOpen: connected!");
    });

    _this.socket.onError(function (event) {
      return _this.debug("socket.onError: can't connect!", event.message);
    });

    _this.socket.onClose(function (event) {
      return _this.debug("socket.onClose: disconnected!");
    }); // open a connection to the server


    _this.socket.connect();
  });

  _defineProperty(this, "disconnect", function () {
    return _this.socket.disconnect();
  });

  _defineProperty(this, "joinSymbol", function (symbol, opts) {
    _this.debug("joinSymbol ", symbol, " ...");

    opts = opts || {};

    var chan = _this.socket.channel(symbol, {
      trades: opts.trades
    });

    chan.join().receive("ignore", function () {
      return _this.debug(symbol, ": access denied");
    }).receive("ok", function () {
      _this.debug(symbol, ": joined!");

      _this.joined_symbols[symbol] = chan;

      if (opts.ok) {
        opts.ok(chan);
      }
    }).receive("timeout", function () {
      return _this.debug(symbol, ": timeout");
    }); // TODO let user configure these callbacks
    // chan.onError(event => console.log("Channel blew up.", event));
    // chan.onClose(event => console.log("Channel closed.", event));

    return chan;
  });

  _defineProperty(this, "subscribeTrades", function (symbol, onUpdateTrades) {
    _this.joinSymbol(symbol, {
      ok: function ok(chan) {
        chan.on("update_trades", function (payload) {
          return onUpdateTrades && onUpdateTrades(payload);
        });
        chan.push("subscribe_trades", {}, TIMEOUT).receive("ok", function (msg) {
          return _this.debug("subscribed_trades for ".concat(symbol, " OK:"), msg);
        });
      }
    });
  });

  _defineProperty(this, "unsubscribeTrades", function (symbol) {
    var chan = _this.joined_symbols[symbol];

    if (chan) {
      _this.debug("unsubscribe_trades for ".concat(symbol, " ..."));

      chan.push("unsubscribe_trades", {}, TIMEOUT);
      delete _this.joined_symbols[symbol];
    }
  });

  _defineProperty(this, "joinedSymbols", function () {
    return Object.keys(_this.joined_symbols);
  });

  // construct a socket
  _opts = _opts || {};
  this.token = _opts.token || 'UNSET_TOKEN';
  this.debug_mode = _opts.debug || false;
  this.joined_symbols = {};
  _opts.connect_on_construct = _opts.connect_on_construct || true;

  if (_opts.connect_on_construct === true) {
    this.connect(_url);
  }
} // TODO orderbook, candles
;

exports.default = Coinray;
module.exports = Coinray;