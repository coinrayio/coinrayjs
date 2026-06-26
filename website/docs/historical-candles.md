---
sidebar_position: 3
title: Historical candles
---

# Historical candles

Use `fetchCandles` to load OHLC history for charts and backtests. Candles are cached
internally, so repeated requests for overlapping ranges are cheap.

## Fetch a range

`start` and `end` are UNIX timestamps in **seconds**. `resolution` is in minutes (or with a
suffix: `"1D"` for one day, `"1W"` for one week).

```js
const now = Math.floor(Date.now() / 1000);
const dayAgo = now - 24 * 60 * 60;

const candles = await coinray.fetchCandles({
  coinraySymbol: "BINA_BTC_USDT",
  resolution: "60",       // 1-hour candles
  start: dayAgo,
  end: now,
});

for (const c of candles) {
  // c.time is a Date; open/high/low/close/baseVolume/quoteVolume are numbers
  console.log(c.time.toISOString(), c.open, c.high, c.low, c.close, c.baseVolume);
}
```

A `Candle` has the shape:

```ts
interface Candle {
  time: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  baseVolume: number;
  quoteVolume: number;
  numTrades: number;
}
```

## Find the earliest available candle

Useful to bound a backfill so you don't request before the market existed.

```js
const firstTime = await coinray.fetchFirstCandleTime({
  coinraySymbol: "BINA_BTC_USDT",
  resolution: "1D",
});
console.log("history starts at", firstTime.toISOString());
```

## Backfill a long range

`fetchCandles` returns one contiguous array; for very long ranges, page by time window and let
the cache stitch them together.

```js
async function backfill(coinraySymbol, resolution, fromTs, toTs, windowSecs = 30 * 24 * 3600) {
  const all = [];
  for (let start = fromTs; start < toTs; start += windowSecs) {
    const end = Math.min(start + windowSecs, toTs);
    const page = await coinray.fetchCandles({coinraySymbol, resolution, start, end});
    all.push(...page);
  }
  return all;
}
```

:::note Live + historical together
Combine this with [live candle subscriptions](./realtime-data.md#candles-live): load history
once with `fetchCandles`, then keep the latest candle updated via `subscribeCandles`.
:::

Next: [place orders and read accounts →](./trading.md)
