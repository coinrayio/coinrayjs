# Coinray.js - Official JavaScript client library for Coinray.io

## Usage

```js
import { Coinray } from "coinrayjs"

let coinray = new Coinray("wss://ws.coinray.io/socket", { token: "YOUR_TOKEN_HERE", debug: true });

coinray.subscribeTrades("BINA_BTC_ETH", (msg) => console.log("BINA_BTC_ETH:", msg));
coinray.subscribeTrades("BTRX_BTC_ETH", (msg) => console.log("BTRX_BTC_ETH:", msg));
coinray.subscribeTrades("HITB_BTC_ETH", (msg) => console.log("HITB_BTC_ETH:", msg));

coinray.unsubscribeTrades("BINA_BTC_ETH");
coinray.unsubscribeTrades("BTRX_BTC_ETH");
coinray.unsubscribeTrades("HITB_BTC_ETH");
```

---

## License

[MIT](LICENSE)
