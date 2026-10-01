import {Candle} from "./types";

// Formula ("synthetic") markets: a coinraySymbol like "BINA_USDT_XYZ / BINA_USDT_BTC"
// is evaluated bar by bar from its legs, so delisted pairs can still be charted.

export type FormulaNode =
  | { type: "num", value: number }
  | { type: "leg", symbol: string }
  | { type: "neg", arg: FormulaNode }
  | { type: "op", op: "+" | "-" | "*" | "/", left: FormulaNode, right: FormulaNode }

type Token = { kind: "num" | "leg" | "op", value: string }

const MAX_LEGS = 10
// ponytail: "-" between word characters stays part of the symbol (futures symbols can contain it),
// so binary minus needs spaces: "A - B". The formula dialog always emits spaced operators.
const TOKEN = /\s*(?:(\d+(?:\.\d+)?(?![A-Za-z0-9_.]))|([A-Za-z0-9_.:]+(?:-[A-Za-z0-9_.:]+)*)|([-+*/()×÷]))\s*/y
const DISPLAY_OP: Record<string, string> = {"+": "+", "-": "−", "*": "×", "/": "÷"}

export const isFormula = (coinraySymbol: string): boolean => /[\s+*/()×÷]/.test(`${coinraySymbol}`)

function tokenize(formula: string): Token[] {
  const tokens: Token[] = []
  TOKEN.lastIndex = 0
  while (TOKEN.lastIndex < formula.length) {
    const at = TOKEN.lastIndex
    const m = TOKEN.exec(formula)
    if (!m) throw new Error(`Invalid formula at "${formula.slice(at)}"`)
    if (m[1] !== undefined) tokens.push({kind: "num", value: m[1]})
    else if (m[2] !== undefined) {
      if (m[2].split("_").length < 3) throw new Error(`Invalid market "${m[2]}" in formula`)
      tokens.push({kind: "leg", value: m[2]})
    } else tokens.push({kind: "op", value: m[3] === "×" ? "*" : m[3] === "÷" ? "/" : m[3]})
  }
  return tokens
}

export function parseFormula(formula: string): FormulaNode {
  const tokens = tokenize(formula)
  let i = 0
  const peek = () => tokens[i]?.kind === "op" ? tokens[i].value : undefined

  const expr = (): FormulaNode => {
    let node = term()
    while (peek() === "+" || peek() === "-") {
      const op = tokens[i++].value as "+" | "-"
      node = {type: "op", op, left: node, right: term()}
    }
    return node
  }
  const term = (): FormulaNode => {
    let node = unary()
    while (peek() === "*" || peek() === "/") {
      const op = tokens[i++].value as "*" | "/"
      node = {type: "op", op, left: node, right: unary()}
    }
    return node
  }
  const unary = (): FormulaNode => {
    if (peek() === "-") {
      i++
      return {type: "neg", arg: unary()}
    }
    return atom()
  }
  const atom = (): FormulaNode => {
    const token = tokens[i++]
    if (!token) throw new Error("Invalid formula: unexpected end")
    if (token.kind === "num") return {type: "num", value: Number(token.value)}
    if (token.kind === "leg") return {type: "leg", symbol: token.value}
    if (token.value === "(") {
      const node = expr()
      if (tokens[i++]?.value !== ")") throw new Error("Invalid formula: missing )")
      return node
    }
    throw new Error(`Invalid formula: unexpected "${token.value}"`)
  }

  const node = expr()
  if (i < tokens.length) throw new Error(`Invalid formula: unexpected "${tokens[i].value}"`)
  const legs = formulaLegs(node)
  if (legs.length === 0) throw new Error("Invalid formula: no markets")
  if (legs.length > MAX_LEGS) throw new Error(`Invalid formula: max ${MAX_LEGS} markets`)
  return node
}

export function formulaLegs(node: FormulaNode, legs: string[] = []): string[] {
  if (node.type === "leg" && !legs.includes(node.symbol)) legs.push(node.symbol)
  if (node.type === "neg") formulaLegs(node.arg, legs)
  if (node.type === "op") {
    formulaLegs(node.left, legs)
    formulaLegs(node.right, legs)
  }
  return legs
}

export function evalFormula(node: FormulaNode, valueOf: (leg: string) => number): number {
  switch (node.type) {
    case "num":
      return node.value
    case "leg":
      return valueOf(node.symbol)
    case "neg":
      return -evalFormula(node.arg, valueOf)
    case "op": {
      const l = evalFormula(node.left, valueOf)
      const r = evalFormula(node.right, valueOf)
      if (node.op === "+") return l + r
      if (node.op === "-") return l - r
      if (node.op === "*") return l * r
      return r === 0 ? NaN : l / r
    }
  }
}

const flatCandle = (c: Candle, time: Date): Candle => ({
  time, open: c.close, high: c.close, low: c.close, close: c.close, baseVolume: 0, quoteVolume: 0, numTrades: 0,
})

// One synthetic bar. high/low are evaluated field-wise (like TradingView spreads) and clamped to cover open/close.
export function combineCandles(node: FormulaNode, legs: Record<string, Candle>, time: Date): Candle | null {
  const field = (f: "open" | "high" | "low" | "close") => evalFormula(node, (leg) => Number(legs[leg][f]))
  const open = field("open"), close = field("close"), hi = field("high"), lo = field("low")
  if (![open, close, hi, lo].every(Number.isFinite)) return null
  return {
    time, open, close,
    high: Math.max(open, close, hi, lo),
    low: Math.min(open, close, hi, lo),
    baseVolume: 0, quoteVolume: 0, numTrades: 0,
  }
}

// Union of the legs' bar times from the latest first bar on; a leg missing a bar is forward-filled flat.
export function alignCandles(legs: string[], series: Record<string, Candle[]>): { time: Date, legs: Record<string, Candle> }[] {
  if (legs.some((leg) => !series[leg]?.length)) return []
  const start = Math.max(...legs.map((leg) => series[leg][0].time.getTime()))
  const times = [...new Set(legs.flatMap((leg) => series[leg].map((c) => c.time.getTime())))]
    .filter((t) => t >= start)
    .sort((a, b) => a - b)
  const next: Record<string, number> = {}
  const last: Record<string, Candle> = {}
  return times.map((t) => {
    const row: Record<string, Candle> = {}
    for (const leg of legs) {
      const s = series[leg]
      next[leg] ??= 0
      while (next[leg] < s.length && s[next[leg]].time.getTime() <= t) last[leg] = s[next[leg]++]
      row[leg] = last[leg].time.getTime() === t ? last[leg] : flatCandle(last[leg], new Date(t))
    }
    return {time: new Date(t), legs: row}
  })
}

export function formulaCandles(node: FormulaNode, series: Record<string, Candle[]>): Candle[] {
  return alignCandles(formulaLegs(node), series)
    .map(({time, legs}) => combineCandles(node, legs, time))
    .filter((c): c is Candle => c !== null)
}

// Realtime: combine each leg's latest candle at the newest bar time once every leg has ticked.
export function latestFormulaCandle(node: FormulaNode, latest: Record<string, Candle>): Candle | null {
  const legs = formulaLegs(node)
  if (legs.some((leg) => latest[leg]?.close === undefined)) return null
  const t = Math.max(...legs.map((leg) => latest[leg].time.getTime()))
  const row: Record<string, Candle> = {}
  for (const leg of legs) row[leg] = latest[leg].time.getTime() === t ? latest[leg] : flatCandle(latest[leg], new Date(t))
  return combineCandles(node, row, new Date(t))
}

// ~5 significant digits, between 2 and 12 decimals.
export function formulaPrecision(value: number): number {
  if (!Number.isFinite(value) || value === 0) return 8
  return Math.min(12, Math.max(2, 4 - Math.floor(Math.log10(Math.abs(value)))))
}

type MarketLike = { exchangeCode: string, baseCurrency: string, quoteCurrency: string, lastPrice?: { toNumber(): number } }

export function formulaSymbolInfo(formula: string, getMarket: (coinraySymbol: string) => MarketLike | undefined) {
  const node = parseFormula(formula)
  const legs = formulaLegs(node)
  const markets: Record<string, MarketLike> = {}
  for (const leg of legs) {
    const market = getMarket(leg)
    if (!market) throw new Error(`Unknown market ${leg}`)
    markets[leg] = market
  }
  const crossExchange = new Set(legs.map((leg) => markets[leg].exchangeCode)).size > 1
  const name = tokenize(formula).map(({kind, value}) => {
    if (kind === "leg") {
      const m = markets[value]
      return `${crossExchange ? `${m.exchangeCode}:` : ""}${m.baseCurrency}/${m.quoteCurrency}`
    }
    return DISPLAY_OP[value] ? ` ${DISPLAY_OP[value]} ` : value
  }).join("").replace(/\( /g, "(").replace(/^ − /, "−")
  const value = evalFormula(node, (leg) => markets[leg].lastPrice?.toNumber() ?? NaN)
  return {name, legs, pricePrecision: formulaPrecision(value)}
}
