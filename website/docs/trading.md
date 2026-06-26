---
sidebar_position: 4
title: Trading & accounts
---

# Trading & accounts

:::info Paid addon required
The order-builder module (`LimitOrder`, `MarketOrder`, `OcoOrder`, `StopLimitOrder`,
`LimitLadderOrder`) is **not part of the default Coinray API integration** — it requires a paid
addon. Market data, historical candles, and real-time streaming work without it; placing orders
through the builders does not. Contact Coinray to enable trading on your account.
:::

Trading in coinrayjs goes through the **order-builder module** — `LimitOrder`, `MarketOrder`,
`OcoOrder`, `StopLimitOrder`, `LimitLadderOrder`. You don't hand raw numbers to the API.
Instead you build an order from a `Market` (which carries precision, min/max sizes, and fees),
let it normalize the amounts and **validate locally**, and only then submit it.

```
Market (precision, fees, min sizes, supportedOrderTypes)
   │
   ▼
LimitOrder / MarketOrder / …        ← the trading module: computes amounts + validates
   │  order.isValid / order.errors
   ▼
coinray.createOrder({...})          ← submit the validated order
```

:::warning Handle keys with care
Account/trading calls need an encrypted API key (`encryptedApiKey`). You never send the raw
key to Coinray — you [wrap it first](#wrap-an-api-key). Treat the wrapped key as a secret.
:::

## 1. Get the market

The `Market` is the source of all the constraints the order builder needs. Fetch it from
[`CoinrayCache`](./getting-started.md#using-coinraycache-for-discovery).

```js
import {CoinrayCache} from "coinrayjs";

const cache = new CoinrayCache(token);
await cache.initialize();

const market = cache.getMarket("BINA_BTC_USDT");
// market.precisionBase / precisionQuote / precisionPrice
// market.minBase / minQuote / makerFee / takerFee
// market.supportedOrderTypes
```

## 2. Check what the market supports (gating)

Not every market accepts every order type. `market.supportedOrderTypes` is the gate — check it
before offering an order type to the user.

```js
import {OrderType} from "coinrayjs";

if (!market.supportedOrderTypes.includes(OrderType.LIMIT)) {
  throw new Error(`${market.coinraySymbol} does not support limit orders`);
}
```

## 3. Build & validate an order

Spread the market's metadata into the order builder, add the side, balances, and amounts. The
builder computes the matching base/quote amounts at the right precision and validates against
min sizes (and, with a `balanceLimit`, available funds).

```js
import {LimitOrder, OrderSide, BalanceLimit} from "coinrayjs";
import BigNumber from "bignumber.js";

const order = new LimitOrder({
  coinraySymbol: market.coinraySymbol,
  precisionBase: market.precisionBase,
  precisionQuote: market.precisionQuote,
  precisionPrice: market.precisionPrice,
  minBase: market.minBase,
  minQuote: market.minQuote,
  makerFee: market.makerFee,
  takerFee: market.takerFee,
  side: OrderSide.BUY,
  balances: {base: new BigNumber("0"), quote: new BigNumber("500")},
  balanceLimit: BalanceLimit.QUOTE, // validate against quote balance; NONE to skip
  price: new BigNumber("60000"),
  baseAmount: new BigNumber("0.01"),
  lockedOn: "baseAmount",           // keep base fixed when price changes
});

if (!order.isValid) {
  console.error(order.errors); // e.g. { baseAmount: ["is too small"], ... }
  return;
}

// The builder filled in the derived amount and clamped precision:
console.log(order.baseAmount.toString(), order.quoteAmount.toString());
```

Useful builder methods while a user edits a ticket:

```js
order.updatePrice(new BigNumber("59000"));   // re-derives the locked side, re-validates
order.updateBaseAmount(new BigNumber("0.02"));
order.updateQuoteAmount(new BigNumber("1200"));
```

## 4. Submit

`createOrder` takes the validated order's normalized values plus your encrypted key.

```js
const {result} = await coinray.createOrder({
  encryptedApiKey,
  coinraySymbol: order.coinraySymbol,
  type: order.orderType,        // OrderType.LIMIT
  side: order.side,
  quantity: order.baseAmount,
  price: order.price,
  postOnly: order.postOnly,
  timeInForce: order.timeInForce,
});
```

## Other order types

Same build → validate → submit flow, different builder:

| Builder | `orderType` | Notes |
| --- | --- | --- |
| `MarketOrder` | `MARKET` | Pass `baseAmount` **or** `quoteAmount`; no price. |
| `LimitOrder` | `LIMIT` | Price + base/quote with `lockedOn`. |
| `StopLimitOrder` | `STOP_LOSS_LIMIT` | Adds a trigger/stop price. |
| `OcoOrder` | `OCO` | One-cancels-the-other: limit + stop legs. `getOrders()` returns both. |
| `LimitLadderOrder` | `LIMIT_LADDER` | Splits into multiple `LimitOrder`s — `getOrders()` returns the rungs. |

For multi-leg builders, submit each leg:

```js
for (const leg of order.getOrders()) {
  await coinray.createOrder({
    encryptedApiKey,
    coinraySymbol: leg.coinraySymbol,
    type: leg.orderType,
    side: leg.side,
    quantity: leg.baseAmount,
    price: leg.price,
  });
}
```

## Wrap an API key

Wrapping requires a device credential and session key — set them with `authenticateDevice`
before wrapping.

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

Verify it works:

```js
const result = await coinray.testAccount({
  exchangeCode: "BINA",
  coinraySymbol: "BINA_BTC_USDT",
  encryptedApiKey,
});
```

## Balances & positions

```js
const balances = await coinray.getBalances({exchangeCode: "BINA", encryptedApiKey});
const positions = await coinray.fetchPositions({exchangeCode: "BINA", encryptedApiKey});
```

The `balances` map (`{base, quote}`) is exactly what the order builder's `balances` field
expects, so you can wire real balances straight into step 3.

## Update & cancel

```js
import {OrderType, OrderSide} from "coinrayjs";
import BigNumber from "bignumber.js";

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
