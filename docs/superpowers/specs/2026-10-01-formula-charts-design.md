# Formula charts (synthetic markets) in coinrayjs

## Goal

Many exchanges delisted BASE/BTC pairs. Users still want to chart XYZ priced in
BTC. Let the chart open a *formula* built from markets that do exist, e.g.
`XYZ/USDT ÷ BTC/USDT` = XYZ/BTC, plus general formulas (`+ − × ÷ ( )` and
numeric constants), like OKX's "Custom formula".

Success: the desktop chart's existing datafeed passes a formula string as the
`coinraySymbol` to `CoinrayCache.fetchCandles` / `subscribeCandles` and gets
correct history and realtime candles, with no backend change.

## Scope

In: formula parsing and evaluation, history candles, realtime candles, first
candle time, symbol info (name and precision) for the chart. All in coinrayjs.

Out: the formula dialog and "recent formulas" UI (desktop app), alerts,
screener or backtests on formulas (server side), trading a formula.

## Symbol format

The formula string is the `coinraySymbol`. Legs are real coinray symbols:

```
BINA_USDT_XYZ / BINA_USDT_BTC
(BINA_USDT_BTC + BINA_USDT_ETH) / 2
```

`isFormula(s)` is true when `s` contains any of `+ - * / ( )` or whitespace.
Coinray symbols contain none of these. Legs may come from different exchanges;
each leg routes through its own exchange API as today.

## Components

### `lib/formula.ts` (new)

- `isFormula(s: string): boolean`
- `parseFormula(s: string): Node` – recursive descent. Grammar:
  `expr = term (('+'|'-') term)*`, `term = unary (('*'|'/') unary)*`,
  `unary = '-' unary | atom`, `atom = number | leg | '(' expr ')'`.
  A leg token is `[A-Z0-9_.:-]+` with at least two `_` (a coinray symbol).
  `×` and `÷` are accepted as aliases for `*` and `/`.
  Anything else throws `Error("Invalid formula: ...")`.
  At least one leg is required, max 10 legs.
- `formulaLegs(node): string[]` – unique leg symbols in order of appearance.
- `evalFormula(node, valueOf: (leg) => number): number` – returns `NaN` on
  division by zero.
- `combineCandles(node, legCandles: Record<string, Candle>, time): Candle | null`
  – one synthetic bar:
  - `open` = eval on legs' opens, `close` = eval on legs' closes.
  - `hi` = eval on legs' highs, `lo` = eval on legs' lows;
    `high` = max(open, close, hi, lo), `low` = min(open, close, hi, lo).
    (Field-wise evaluation like TradingView spread charts; the clamp keeps
    the bar valid when a leg is in a denominator.)
  - `baseVolume`, `quoteVolume`, `numTrades` = 0.
  - Returns `null` if any value is non-finite (bar is skipped).
- `alignCandles(legs: string[], series: Record<string, Candle[]>)` – yields one
  `Record<leg, Candle>` per timestamp in the union of all legs' times, starting
  at the latest of the legs' first bars. A leg missing a bar is forward-filled
  with a flat candle at its previous close.
- `formulaSymbolInfo(formula, cache)` – `{name, legs, pricePrecision}`.
  `name` replaces each leg with its market's `BASE/QUOTE` (with an exchange
  prefix only when legs span exchanges) and operators with ` + − × ÷ `.
  `pricePrecision` is from the formula evaluated on legs' last prices:
  `clamp(4 - floor(log10(|v|)), 2, 12)` (≈5 significant digits);
  8 when the value is unknown. Throws if a leg market is unknown.

### `CoinrayCache` changes (`lib/coinray-cache.ts`)

At the top of each method, branch on `isFormula(coinraySymbol)`:

- `fetchCandles` – parse, fetch all legs in parallel via `this.fetchCandles`
  with the same params, align, combine, drop `null` bars.
- `fetchFirstCandleTime` – max of the legs' first candle times.
- `subscribeCandles(formula, resolution, callback)` – subscribe the caller
  to each leg with a leg callback that stores the leg's latest candle and,
  once every leg has one, emits
  `{coinraySymbol: formula, resolution, candle, previousCandles: []}`.
  The newest bar time across legs is the bar time; legs behind it are
  forward-filled from their close. Leg callbacks are stored in a
  `Map<callback, {legs, legCallbacks}>` keyed per `formula-resolution`.
- `unsubscribeCandles` – remove the stored leg callbacks (all of them when no
  callback is given).
- `getMarket(formula)` unchanged (returns undefined); the chart uses
  `formulaSymbolInfo` instead.

Orderbook, trades and ticker methods do not support formulas; they throw
`Error("Not supported for formula symbols")` instead of silently routing to an
undefined API.

Export `isFormula`, `parseFormula`, `formulaSymbolInfo` from `lib/index.ts`.

## Error handling

- Bad syntax, unknown leg exchange or too many legs: throw from
  `fetchCandles` / `subscribeCandles` / `formulaSymbolInfo` with a readable
  message for the dialog to show.
- Division by zero or non-finite result: that bar is skipped, never `NaN`
  candles.
- A leg with no data in the range: `fetchCandles` returns `[]`.

## Testing (`test/formula.test.ts`, vitest)

- Parser: precedence (`a + b * c`), parentheses, unary minus, `×`/`÷`
  aliases, rejection of garbage and of formulas without legs.
- `combineCandles`: XYZ/USDT ÷ BTC/USDT gives the XYZ/BTC close; high/low clamp
  holds; divide by zero yields `null`.
- `alignCandles`: forward-fill of a missing bar, start at the latest first bar.
- `fetchCandles` on a formula with a stubbed `CoinrayCache.fetchCandles` per leg.
- `subscribeCandles`: emits only once all legs have ticked, unsubscribe removes
  leg listeners.
- `formulaSymbolInfo` precision: 65000 → 2, 1.5 → 4, 0.00002345 → 9.
