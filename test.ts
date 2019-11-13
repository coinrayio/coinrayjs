import Coinray from "./lib/coinray"
import {OrderSide, OrderType} from "./lib/types";

console.log("Testing");

const api = new Coinray();

api.createOrder({
  credentials: {apiKey: "", secret: ""},
  coinraySymbol: "BINA_USDT_BTC",
  price: 15000,
  quantity: 0.00001,
  side: OrderSide.BUY,
  type: OrderType.LIMIT
});

console.log();
