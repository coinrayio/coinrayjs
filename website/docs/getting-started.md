---
sidebar_position: 1
title: Getting started
---

# Getting started

## Install

```bash
npm install coinrayjs
```

coinrayjs ships ES modules and TypeScript types. It works in the browser and in Node.

:::info Paid product
Coinray API access is a **paid product** — you need an active Coinray plan to obtain a token.
Real-time streaming and candle history are included; the [trading order
builders](./trading.md) require an **additional paid addon** on top. Contact Coinray to get
access.
:::

## Create a client

The `Coinray` client takes a Coinray JWT token. Endpoints default to Coinray's production
infrastructure, but you can override them.

```js
import Coinray from "coinrayjs";

const coinray = new Coinray(token);

// or with custom endpoints
const coinray = new Coinray(token, {
  apiEndpoint: "https://api.coinray.eu",
  orderEndpoint: "https://api.coinray.eu",
  websocketEndpoint: "wss://ws.coinray.eu/v1",
});
```

## Token expiry & refresh

Coinray tokens expire. Register a refresh callback and the client will call it when the token
is close to expiring, then keep using the new token. Start the periodic check with `checkToken()`.

```js
coinray.onTokenExpired(async () => {
  const newToken = await myBackend.fetchFreshCoinrayToken();
  return newToken; // the client adopts it automatically
});

coinray.checkToken(); // begins the expiry watch loop

// You can also push a new token in at any time:
coinray.refreshToken(newToken);
```

## Connection lifecycle

The WebSocket connection is opened lazily on the first subscription, but you can manage it
explicitly. Subscriptions are automatically re-established on reconnect.

```js
coinray.onOpen(() => console.log("connected"));
coinray.onError((e) => console.error("socket error", e));

await coinray.connect();   // open the socket
coinray.reconnect();       // drop and reopen
coinray.disconnect();      // close the socket, keep subscriptions
coinray.destroy();         // tear everything down (timers, listeners, socket)
```

:::tip Always clean up
Call `coinray.destroy()` when your component unmounts or your process shuts down — it clears
the token-check interval and the time-offset timer as well as the socket.
:::

## Using CoinrayCache for discovery

If you need the list of exchanges and their markets (and want them kept fresh), use
`CoinrayCache`. It wraps a `Coinray` client and refreshes on an interval.

```js
import {CoinrayCache} from "coinrayjs";

const cache = new CoinrayCache(token, {apiEndpoint: "https://api.coinray.eu"});
await cache.initialize();

const exchanges = cache.getExchanges();
const binanceMarkets = cache.getExchange("BINA").markets;
const market = cache.getMarket("BINA_BTC_USDT");

cache.destroy(); // stop refresh timers when done
```

Next: [stream live market data →](./realtime-data.md)
