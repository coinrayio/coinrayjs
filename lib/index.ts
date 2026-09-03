import BigNumber from "bignumber.js";
import Coinray from "./coinray";

import CoinrayCache from "./coinray-cache";
import CurrentMarket from "./current-market";
import locales from "./i18n/locales"

export * from "./util";
export * from "./orders";

export * from "./types";
export * as types from "./types";
export * from "./orders/limit-ladder"

// bignumber.js 10 dropped the DEBUG flag and made invalid input -- undefined,
// null, "", "abc" -- throw instead of yielding NaN, for the coercing methods
// (plus, dividedBy, gt, ...) as well as the constructor. Version 11
// reintroduced the escape hatch as STRICT. Consumers rely on the old leniency,
// and the build bundles bignumber.js into dist, so a consumer setting STRICT on
// its own copy would never reach this one -- it has to be set here.
BigNumber.set({STRICT: false})

export {CoinrayCache, CurrentMarket, locales}
export default Coinray
