# Fix: `fetchCandles` boundary exclusion

## Proposed change

In `lib/coinray.ts`, line 665, change:

```ts
let minTime = end
```

to:

```ts
let minTime = end + 1
```

## Why not `<=` on line 701?

The obvious fix would be changing the history filter on line 701 from `<` to `<=`:

```ts
historyCandles = results[j].filter(({time}) => time.getTime() / 1000 < minTime)
```

This is unsafe. The `< minTime` filter serves as a **deduplication boundary** between:
- Open candles (Path A) and history candles
- Successive history batches

Changing to `<=` would introduce duplicate candles:
- **Path A**: an open candle at time T is pushed to `candles`, then `minTime` is set to T. A history candle at time T would also pass `<= T` — duplicate.
- **Between batches**: batch 1's earliest candle at time T sets `minTime = T`. Batch 2 also contains T — duplicate.

## Why `end + 1` is safe

`minTime` is used in four places after initialization. Each is unaffected by `+1`:

### 1. `candleTime(2, resolution, minTime)` — line 680

```ts
// candleTime does: Math.floor(minTime / timeSpan) * timeSpan - timeSpan
// For resolution "60", timeSpan = 3600
//
// end on an exact boundary (e.g. 1774929600):
//   Math.floor(1774929600 / 3600) * 3600 - 3600 = 1774926000
//
// end + 1 (e.g. 1774929601):
//   Math.floor(1774929601 / 3600) * 3600 - 3600 = 1774926000
//
// Same result. Math.floor absorbs the +1 because candle timestamps are
// always multiples of timeSpan. The +1 never crosses a boundary.
```

This feeds into `getBucketStartDates(start, newEnd, bucketType)` on line 681, so bucket calculation is also unchanged.

### 2. `Math.min(openCandles[0].time.getTime() / 1000, minTime)` — line 672 (Path A only)

Open candle timestamps are on candle boundaries, so `openCandleTime <= end < end + 1`. `Math.min` picks `openCandleTime`. Result identical to before.

### 3. History filter `time.getTime() / 1000 < minTime` — line 701

- **Path B, first iteration**: `< end + 1` is effectively `<= end` for integer timestamps. This is the fix — the boundary candle is now included.
- **Path B, subsequent iterations**: `minTime` has been updated to the earliest candle timestamp from the previous batch (line 703). The `+1` is gone. Deduplication works identically.
- **Path A**: `minTime` was already lowered to `openCandleTime` on line 672. The `+1` was absorbed by `Math.min`. No change.

### 4. `Math.min(historyCandles[0].time.getTime() / 1000, minTime)` — line 703

First iteration in Path B: `Math.min(earliestHistoryCandle, end + 1)`. Since history candles have timestamps `<= end`, this resolves to an actual candle timestamp. Subsequent iterations use that timestamp, not `end + 1`. No cascading effect.

### Final filter (lines 712-714) — unchanged

```ts
return candles.filter(({time}) => {
  let current = time.getTime() / 1000
  return current >= start && current <= end
})
```

The boundary candle now survives the history filter and reaches this final pass. Its timestamp equals `end`, so `current <= end` keeps it. No extra candles leak through.

## Summary

| Code path | Before (`end`) | After (`end + 1`) | Change? |
|---|---|---|---|
| `candleTime` (line 680) | same result | same result | No |
| `Math.min` open candles (line 672) | picks openCandleTime | picks openCandleTime | No |
| History filter, 1st iter (line 701) | `< end` excludes boundary | `< end + 1` includes boundary | **Yes — the fix** |
| History filter, later iters (line 701) | `< candleTime` | `< candleTime` | No |
| `Math.min` history (line 703) | picks candleTime | picks candleTime | No |
| Final filter (line 712-714) | `<= end` | `<= end` | No |

No duplicates. No extra candles. No change to Path A. No change to bucket calculation. The only behavioral change is: the boundary candle is now included in past-bucket history requests.

## Test

`test/fetchcandles-boundary.test.ts` — test `"should include the boundary candle for past-month requests"` demonstrates the bug with real API calls. It fetches candles with `end` on an exact hour boundary for both a past-month and current-month date, then asserts both return the boundary candle. Before the fix, the past-month request excludes it (100 bars, last at `end - 3600`). After the fix, both return it (101 bars, last at `end`).

Run with: `npm test` (requires `VITE_COINRAY_TOKEN` in `.env` — see `.env.example`).
