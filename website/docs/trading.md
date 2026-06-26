---
sidebar_position: 4
title: Trading & accounts
---

# Trading & accounts

Authenticated trading requires an exchange API key. coinrayjs never sends your raw key to
Coinray in the clear — you first **wrap** (encrypt) it, then pass the resulting
`encryptedApiKey` to every account/trading call.

:::warning Handle keys with care
Wrapping requires a device credential and session key (`authenticateDevice`). Treat the
encrypted key as a secret and scope it to the session that created it.
:::

## Wrap an API key

```js
import Coinray from "coinrayjs";

const coinray = new Coinray(token);
coinray.authenticateDevice(credential, sessionKey);

const encryptedApiKey = await coinray.wrapApiKey({
  apiKey: "EXCHANGE_API_KEY",
  apiSecret: "EXCHANGE_API_SECRET",
  // some exchanges also need: passphrase, uid, ...
});
```

## Verify the account works

```js
const result = await coinray.testAccount({
  exchangeCode: "BINA",
  coinraySymbol: "BINA_BTC_USDT",
  encryptedApiKey,
});
```

## Balances & positions

```js
const balances = await coinray.getBalances({
  exchangeCode: "BINA",
  encryptedApiKey,
});

const positions = await coinray.fetchPositions({
  exchangeCode: "BINA",
  encryptedApiKey,
});
```

## Place an order

Quantities and prices are [BigNumber](https://mikemcl.github.io/bignumber.js/) instances.
`type` and `side` come from the exported enums.

```js
import Coinray, {OrderType, OrderSide} from "coinrayjs";
import BigNumber from "bignumber.js";

const {result} = await coinray.createOrder({
  encryptedApiKey,
  coinraySymbol: "BINA_BTC_USDT",
  type: OrderType.LIMIT,
  side: OrderSide.BUY,
  quantity: new BigNumber("0.01"),
  price: new BigNumber("60000"),
  timeInForce: "gtc",     // TimeInForce.GTC
  postOnly: true,
});
```

Available order types: `MARKET`, `LIMIT`, `LIMIT_LADDER`, `STOP_LOSS`, `OCO`,
`STOP_LOSS_LIMIT`, `STOP_LOSS_MARKET`, `TAKE_PROFIT`, `TAKE_PROFIT_LIMIT`,
`TAKE_PROFIT_MARKET`. See [`OrderType`](./api/index.md) in the API reference.

## Update & cancel

```js
await coinray.updateOrder({
  encryptedApiKey,
  coinraySymbol: "BINA_BTC_USDT",
  orderId: "abc123",
  type: OrderType.LIMIT,
  side: OrderSide.BUY,
  quantity: new BigNumber("0.02"),
  price: new BigNumber("59000"),
});

await coinray.cancelOrder({
  encryptedApiKey,
  coinraySymbol: "BINA_BTC_USDT",
  orderType: OrderType.LIMIT,
  orderId: "abc123",
});
```

## Futures settings

```js
await coinray.setLeverage({coinraySymbol: "BINA_BTC_USDT", leverage: 5, encryptedApiKey});
await coinray.setMarginType({coinraySymbol: "BINA_BTC_USDT", marginType: "isolated", encryptedApiKey});
```

See the full surface in the **[API Reference](./api/index.md)**.
