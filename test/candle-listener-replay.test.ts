import {describe, it, expect, vi, beforeEach, afterEach} from "vitest"

// no network: the constructor loads the server time offset
vi.mock("axios", () => ({default: vi.fn(() => Promise.reject(new Error("offline")))}))

import Coinray from "../lib"

const symbol = "BINA_USDT_BTC"
const resolution = "1S"

const fakeChannel = () => {
  const handlers: Record<string, (payload: any) => void> = {}
  return {
    handlers,
    push: vi.fn(),
    on: (event: string, handler: (payload: any) => void) => { handlers[event] = handler },
  }
}

// three trades in three different seconds, newest first as the server sends them
const snapshotTrades = () => {
  const now = Math.floor(Date.now() / 1000) * 1000
  // wire format: [id, time (s), price, quantity, isBuy]
  return [1, 2, 3].map((ago, i) => [`t${i}`, (now - ago * 1000) / 1000, `${100 + i}`, "1", "1"])
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0))

describe("candle listeners joining an open stream", () => {
  let coinray: any
  let channel: ReturnType<typeof fakeChannel>

  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    coinray = new Coinray("token")
    channel = fakeChannel()
    coinray.connect = async () => {}
    coinray.getChannel = () => channel
  })

  afterEach(() => {
    coinray.destroy()
    vi.restoreAllMocks()
  })

  const openStream = async () => {
    const first = vi.fn()
    await coinray.subscribeCandles({coinraySymbol: symbol, resolution}, first)
    channel.handlers.snapshot({symbol, trades: snapshotTrades()})
    return first
  }

  it("replays the buffered snapshot to a second listener, async and only to it", async () => {
    const first = await openStream()
    expect(first).toHaveBeenCalledTimes(1)
    const original = first.mock.calls[0][0]
    expect(original.previousCandles.length).toBe(3)

    const second = vi.fn()
    const subscribed = coinray.subscribeCandles({coinraySymbol: symbol, resolution}, second)
    expect(second).not.toHaveBeenCalled() // not synchronously
    await subscribed

    await flush()
    expect(second).toHaveBeenCalledTimes(1)
    const replayed = second.mock.calls[0][0]
    expect(replayed.coinraySymbol).toBe(symbol)
    expect(replayed.resolution).toBe(resolution)
    expect(replayed.candle).toBe(original.candle)
    expect(replayed.previousCandles.map((c) => c.time.getTime()))
      .toEqual(original.previousCandles.map((c) => c.time.getTime()))
    expect(replayed.previousCandles.map((c) => c.close))
      .toEqual(original.previousCandles.map((c) => c.close))

    expect(first).toHaveBeenCalledTimes(1) // no duplicate to the existing listener
  })

  it("does not replay to a listener that left before the replay ran", async () => {
    await openStream()
    const second = vi.fn()
    const subscribed = coinray.subscribeCandles({coinraySymbol: symbol, resolution}, second)
    coinray.unsubscribeCandles({coinraySymbol: symbol, resolution}, second)
    await subscribed
    await flush()
    expect(second).not.toHaveBeenCalled()
  })

  it("does not replay when no snapshot has arrived yet; the listener gets the real one", async () => {
    const first = vi.fn()
    await coinray.subscribeCandles({coinraySymbol: symbol, resolution}, first)
    const second = vi.fn()
    await coinray.subscribeCandles({coinraySymbol: symbol, resolution}, second)
    await flush()
    expect(second).not.toHaveBeenCalled()

    channel.handlers.snapshot({symbol, trades: snapshotTrades()})
    expect(first).toHaveBeenCalledTimes(1)
    expect(second).toHaveBeenCalledTimes(1)
  })

  it("fetchCandles for seconds returns the snapshot of an open stream", async () => {
    await openStream()
    const now = Date.now() / 1000
    const candles = await coinray.fetchCandles({coinraySymbol: symbol, resolution, start: now - 60, end: now})
    expect(candles.length).toBe(3)
  })

  it("fetchCandles for seconds waits for the snapshot of a stream it opens", async () => {
    const now = Date.now() / 1000
    const pending = coinray.fetchCandles({coinraySymbol: symbol, resolution, start: now - 60, end: now})
    await new Promise((resolve) => setTimeout(resolve, 20))
    channel.handlers.snapshot({symbol, trades: snapshotTrades()})
    const candles = await pending
    expect(candles.length).toBe(3)
  })
})
