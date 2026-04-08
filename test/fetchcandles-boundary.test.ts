import {describe, it, expect} from "vitest"
import Coinray from "../lib"

const token = import.meta.env.VITE_COINRAY_TOKEN ?? ""

describe.skipIf(!token)("fetchCandles boundary exclusion bug", () => {
  const coinray = new Coinray(token)
  const symbol = "BINA_USDT_BTC"
  const resolution = "60"

  it("should include the boundary candle for past-month requests", async () => {
    // Two dates with end at an exact hour boundary — one in a past month, one in the current month.
    // Both should return the same number of bars (boundary candle included).
    const now = new Date()
    const currentMonth = now.getUTCMonth()
    const currentYear = now.getUTCFullYear()

    // Past month: 1st day of current month 04:00 UTC minus 1 day = last day of previous month
    const endPastMonth = Date.UTC(currentYear, currentMonth, 1, 4, 0, 0) / 1000 - 86400
    // Round down to the nearest hour to ensure it's on an exact boundary
    const endPast = endPastMonth - (endPastMonth % 3600)

    // Current month: pick a recent hour that's definitely in the current month
    const endCurrentMonth = Date.UTC(currentYear, currentMonth, 2, 4, 0, 0) / 1000
    const endCurrent = endCurrentMonth - (endCurrentMonth % 3600)

    const countBack = 100
    const startPast = endPast - countBack * 3600
    const startCurrent = endCurrent - countBack * 3600

    const [pastBars, currentBars] = await Promise.all([
      coinray.fetchCandles({coinraySymbol: symbol, resolution, start: startPast, end: endPast}),
      coinray.fetchCandles({coinraySymbol: symbol, resolution, start: startCurrent, end: endCurrent}),
    ])

    const pastLastTime = pastBars.length > 0 ? pastBars[pastBars.length - 1].time.getTime() / 1000 : null
    const currentLastTime = currentBars.length > 0 ? currentBars[currentBars.length - 1].time.getTime() / 1000 : null

    console.log(`Past month:    ${pastBars.length} bars, last=${pastLastTime ? new Date(pastLastTime * 1000).toISOString() : "none"}, end=${new Date(endPast * 1000).toISOString()}`)
    console.log(`Current month: ${currentBars.length} bars, last=${currentLastTime ? new Date(currentLastTime * 1000).toISOString() : "none"}, end=${new Date(endCurrent * 1000).toISOString()}`)

    // The boundary candle (whose timestamp === end) should be present in both cases
    expect(pastLastTime).toBe(endPast)
    expect(currentLastTime).toBe(endCurrent)

    // Both should return countBack + 1 bars (start to end inclusive)
    expect(pastBars.length).toBe(currentBars.length)
  })
})
