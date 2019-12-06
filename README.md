# Coinray.js - Official JavaScript client library for Coinray.io

## Usage

```js
import { Coinray } from "coinrayjs"

let coinray = new Coinray(token);
```

### Subscribe to trades
```js
const handle = coinray.subscribeTrades({coinraySymbol: "BINA_BTC_ETH"}, (msg) => console.log("BINA_BTC_ETH:", msg));
coinray.unsubscribeTrades({coinraySymbol: "BINA_BTC_ETH"}, handle);
```

### Subscribe to candles
```js
const handle = coinray.subscribeCandles({coinraySymbol: "BINA_BTC_ETH", resolution: "60"}, (msg) => console.log("BINA_BTC_ETH:", msg));
coinray.subscribeCandles({coinraySymbol: "BINA_BTC_ETH", resolution: "60"}, handle);
```

---

## License

[MIT](LICENSE)
