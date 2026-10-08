import BigNumber from "bignumber.js";
import EventEmitter from "./event-emitter";
import Market from "./market";
import {evalFormula, FormulaNode, formulaLegs, formulaSymbolInfo, parseFormula} from "./formula";

// A formula symbol in a watchlist: the display side of a Market (prices, 24h change, status), evaluated
// from the leg markets on every read, so it is as fresh as its legs and picks up legs that load later.
// Not tradeable and no volume: a ratio of markets has no volume of its own.
export default class FormulaMarket extends EventEmitter {
  readonly isFormula = true
  readonly coinraySymbol: string
  readonly legs: string[]
  readonly exchangeCodes: string[]
  readonly marketCap = undefined
  readonly baseCurrency = undefined
  readonly quoteCurrency = undefined
  readonly volume = undefined
  readonly quoteVolume = undefined
  readonly btcVolume = undefined
  readonly usdVolume = undefined
  private readonly node: FormulaNode
  private readonly getMarket: (coinraySymbol: string) => Market | undefined
  private _precisionPrice?: number

  // Throws when the formula doesn't parse.
  constructor(formula: string, getMarket: (coinraySymbol: string) => Market | undefined) {
    super()
    this.node = parseFormula(formula)
    this.coinraySymbol = formula
    this.legs = formulaLegs(this.node)
    this.exchangeCodes = [...new Set(this.legs.map((leg) => leg.split("_")[0]))]
    this.getMarket = getMarket
  }

  // Legs whose exchange or market is not in the cache (yet).
  get missingLegs(): string[] {
    return this.legs.filter((leg) => !this.getMarket(leg))
  }

  get displayName(): string {
    if (this.missingLegs.length) return this.coinraySymbol
    return formulaSymbolInfo(this.coinraySymbol, this.getMarket).name
  }

  get exchangeCode(): string | undefined {
    return this.exchangeCodes.length === 1 ? this.exchangeCodes[0] : undefined
  }

  // ACTIVE when every leg is, else the first other leg status.
  get status(): string | undefined {
    const markets = this.legMarkets()
    if (!markets) return
    return markets.find((m) => m.status !== "ACTIVE")?.status ?? "ACTIVE"
  }

  // Same precision as the chart's price scale; kept once known so a row's decimals don't jump.
  get precisionPrice(): number | undefined {
    if (this._precisionPrice === undefined && this.lastPrice) {
      this._precisionPrice = formulaSymbolInfo(this.coinraySymbol, this.getMarket).pricePrecision
    }
    return this._precisionPrice
  }

  get lastPrice(): BigNumber | undefined {
    return this.evaluate((m) => m.lastPrice)
  }

  // The formula's price 24h ago: evaluated point-wise from the legs' 24h-ago prices.
  get openPrice(): BigNumber | undefined {
    return this.evaluate((m) => m.openPrice)
  }

  get change(): number | undefined {
    const last = this.lastPrice, open = this.openPrice
    if (!last || !open || open.isZero()) return
    return last.minus(open).dividedBy(open).multipliedBy(100).toNumber()
  }

  private legMarkets(): Market[] | undefined {
    const markets = this.legs.map((leg) => this.getMarket(leg))
    return markets.every(Boolean) ? markets : undefined
  }

  // undefined while a leg is missing or has no price (0), and for non-finite results (division by zero).
  private evaluate(price: (market: Market) => BigNumber | undefined): BigNumber | undefined {
    const markets = this.legMarkets()
    if (!markets) return
    const values: Record<string, number> = {}
    for (let i = 0; i < this.legs.length; i++) {
      const value = price(markets[i])?.toNumber()
      if (!value) return
      values[this.legs[i]] = value
    }
    const result = evalFormula(this.node, (leg) => values[leg])
    return Number.isFinite(result) ? new BigNumber(result) : undefined
  }
}
