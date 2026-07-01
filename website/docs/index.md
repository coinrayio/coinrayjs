---
slug: /
sidebar_position: 0
title: Overview
---

# coinrayjs

Official JavaScript / TypeScript client for [Coinray.io](https://coinray.io). It gives you
real-time market data (tickers, trades, order book, candles) over WebSockets, historical
candle history, and authenticated trading against the exchanges Coinray aggregates.

```bash
npm install coinrayjs
# or
yarn add coinrayjs
```

:::info Paid product
Coinray API access requires a paid plan (you need a token), and the [trading order
builders](./trading.md) require an additional paid addon. See [Getting
started](./getting-started.md) for details.
:::

```js
import Coinray from "coinrayjs";

const coinray = new Coinray(token, {
  apiEndpoint: "https://gateway.coinray.eu",
  orderEndpoint: "https://gateway.coinray.eu",
  websocketEndpoint: "wss://gateway.coinray.eu/v1",
});

const handle = coinray.subscribeTrades(
  {coinraySymbol: "BINA_BTC_USDT"},
  ({trades}) => console.log(trades),
);
```

## Where to go next

- **[Getting started](./getting-started.md)** — install, authenticate, and manage the connection lifecycle.
- **[Real-time market data](./realtime-data.md)** — subscribe to tickers, trades, order book, and candles.
- **[Historical candles](./historical-candles.md)** — fetch OHLC history for charts and backtests.
- **[Trading & accounts](./trading.md)** — wrap API keys, place/cancel orders, read balances and positions. _(order builders are a paid addon)_
- **[API Reference](./api/index.md)** — generated from the TypeScript types.
- **[Playground](/playground)** — run live API calls from your browser with your own token.

## Two ways to use the client

| Use the... | When |
| --- | --- |
| `Coinray` client directly | You want fine-grained control over individual subscriptions and calls. |
| `CoinrayCache` | You want exchanges + markets loaded and kept fresh for you, with a `CurrentMarket` helper per symbol. |

Most apps start with `CoinrayCache` for discovery (exchanges/markets) and use the underlying
`Coinray` client for streaming and trading.

:::note Coinray symbols
Markets are addressed by a **coinray symbol**: `EXCHANGE_BASE_QUOTE`, e.g. `BINA_BTC_USDT`
(Binance BTC priced in USDT). You can discover valid symbols via `CoinrayCache`.
:::
