import {describe, test, expect} from "vitest"
import {filterMarkets} from "../lib/util"

const market = (overrides: any) => ({
  fullDisplayName: "EX: BTC/USDT",
  baseCurrency: "BTC",
  quoteCurrency: "USDT",
  ...overrides,
})

describe("filterMarkets with optional properties", () => {
  test("skips markets where the queried property is undefined", () => {
    const markets = {
      a: market({coinraySymbol: "a", groupName: "Perp"}),
      b: market({coinraySymbol: "b", groupName: undefined}),
      c: market({coinraySymbol: "c"}),
    } as any

    const result = filterMarkets(markets, {query: "Perp", marketProperty: "groupName"})

    expect(Object.keys(result)).toEqual(["a"])
  })

  test("matches markets that have the property set", () => {
    const markets = {
      a: market({coinraySymbol: "a", groupName: "xPerp"}),
      b: market({coinraySymbol: "b", groupName: "Futures"}),
      c: market({coinraySymbol: "c", groupName: "Perp"}),
    } as any

    const result = filterMarkets(markets, {query: "perp", marketProperty: "groupName"})

    // case-insensitive substring on groupName: "xPerp" and "Perp"
    expect(Object.keys(result).sort()).toEqual(["a", "c"])
  })
})
