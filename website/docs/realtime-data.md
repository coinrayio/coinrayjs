---
sidebar_position: 2
title: Real-time market data
---

# Real-time market data

All streaming subscriptions return a callback-based handle. The pattern is the same across
data types: `subscribeX(params, callback)` to start, `unsubscribeX(params, callback)` to stop.
The socket connects automatically on the first subscription and re-subscribes on reconnect.

:::tip Try it live
Head to the **[Playground](/playground)** to run these subscriptions against Coinray with your
own token and watch the messages arrive.
:::

## Trades

```js
const onTrades = ({coinraySymbol, trades}) => {
  for (const t of trades) {
    console.log(coinraySymbol, t.price, t.quantity, t.time);
  }
};

coinray.subscribeTrades({coinraySymbol: "BINA_BTC_USDT"}, onTrades);

// later
coinray.unsubscribeTrades({coinraySymbol: "BINA_BTC_USDT"}, onTrades);
```

## Order book

You receive a snapshot first, then incremental updates. The payload carries `bids` and `asks`.

```js
const onBook = ({coinraySymbol, type, orderBook}) => {
  // type is "orderBook:snapshot" or "orderBook:update"
  console.log(coinraySymbol, type, orderBook.bids[0], orderBook.asks[0]);
};

coinray.subscribeOrderBook({coinraySymbol: "BINA_BTC_USDT"}, onBook);
coinray.unsubscribeOrderBook({coinraySymbol: "BINA_BTC_USDT"}, onBook);
```

## Tickers

Tickers are subscribed in batches by coinray symbol. Pass `reset: true` to replace the current
set instead of adding to it.

```js
const onTicker = (ticker) => console.log(ticker.coinraySymbol, ticker.lastPrice);

coinray.subscribeTickers(["BINA_BTC_USDT", "BINA_ETH_USDT"], false, onTicker);

coinray.unsubscribeTickers(["BINA_ETH_USDT"], onTicker);
coinray.unsubscribeAllTickers();
```

## Candles (live)

Live candles are built from the trade stream. Provide a `resolution` (in minutes, or with an
`S` suffix for seconds — e.g. `"1"`, `"60"`, `"1D"`).

```js
const onCandle = ({coinraySymbol, candle}) => {
  console.log(coinraySymbol, candle.time, candle.open, candle.close);
};

coinray.subscribeCandles(
  {coinraySymbol: "BINA_BTC_USDT", resolution: "60"},
  onCandle,
);

coinray.unsubscribeCandles(
  {coinraySymbol: "BINA_BTC_USDT", resolution: "60"},
  onCandle,
);
```

## Per-market helper: CurrentMarket

When you're focused on a single market (e.g. a trading screen), `CurrentMarket` wraps the
subscriptions for one symbol and tracks the latest ticker, trades, and order book for you.

```js
import {CoinrayCache, CurrentMarket} from "coinrayjs";

const cache = new CoinrayCache(token);
await cache.initialize();

const current = new CurrentMarket(cache);
current.setMarket(cache.getMarket("BINA_BTC_USDT"));

current.subscribeTrades((trades) => console.log("trades", trades));
current.subscribeOrderBook((book) => console.log("book", book));
current.subscribeMarketUpdates((ticker) => console.log("ticker", ticker));
```

Next: [fetch historical candles →](./historical-candles.md)
