const Coinray = require("./dist/coinray.js").default


const token = "eyJraWQiOiJSRVVrOGZZVnNveXBSUDIzIiwiYWxnIjoiSFMyNTYifQ.eyJpc3MiOiJSRVVrOGZZVnNveXBSUDIzIiwic3ViIjpudWxsfQ.0Ttx4TjB-wOe2r75EvB4854bJd8c2-xJ0LRby3WhDJ4";
const api = new Coinray(token);
api.setTransport(require("ws"));

// api.subscribeTrades({coinraySymbol: "BINA_USDT_BTC"}, (event) => {
//   console.log("BINA_USDT_BTC", event)
// });

const handle1 = api.subscribeCandles({ coinraySymbol: "BINA_USDT_BTC", resolution: "1" }, (event) => {
  console.log("BINA_USDT_BTC 1", event)
});

const handle3 = api.subscribeCandles({ coinraySymbol: "BINA_USDT_BTC", resolution: "3" }, (event) => {
  console.log("BINA_USDT_BTC 3", event)
});

// api.unsubscribeTrades({coinraySymbol: "BINA_BTC_ETH"}, handle);

// api.fetchCandles({ coinraySymbol: "BINA_USDT_BTC", resolution: "60" }).then((candles) => {
//   console.log(candles.length)
// });
//
// api.fetchLastCandle({ coinraySymbol: "BINA_USDT_BTC", resolution: "60" }).then((candles) => {
//   console.log(candles)
// });

api.onOpen((test) => {
  console.log("onOpen", test)
});

api.onError((test) => {
  console.log("onError", test)
});

setTimeout(() => api.unsubscribeCandles({ coinraySymbol: "BINA_USDT_BTC", resolution: "3" }, handle3), 5000);
setTimeout(() => api.unsubscribeCandles({ coinraySymbol: "BINA_USDT_BTC", resolution: "1" }, handle1), 7000);

setTimeout(() => {
  api.subscribeCandles({ coinraySymbol: "BINA_USDT_BTC", resolution: "1" }, (event) => {
    console.log("BINA_USDT_BTC 1", event)
  });
}, 8000);
