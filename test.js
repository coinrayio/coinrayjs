"use strict";
exports.__esModule = true;
var coinray_1 = require("./lib/coinray");
var types_1 = require("./lib/types");
console.log("Testing");
var api = new coinray_1["default"]();
api.createOrder({
    credentials: { apiKey: "", secret: "" },
    coinraySymbol: "BINA_USDT_BTC",
    price: 15000,
    quantity: 0.00001,
    side: types_1.OrderSide.BUY,
    type: types_1.OrderType.LIMIT
});
console.log();
