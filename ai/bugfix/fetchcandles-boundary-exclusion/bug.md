# Bug: `fetchCandles` excludes boundary candle for past-month requests

## Summary

`fetchCandles` in `lib/coinray.ts` returns inconsistent results at the `end` boundary depending on whether the requested month is the current month or a past month. When `end` falls exactly on a candle timestamp and the month is in the past, that candle is excluded. When the month is current, it's included.

## Affected code

- `lib/coinray.ts` — `fetchCandles()` (lines ~650-716)
- `lib/util.ts` — `toBucketEnd()` (lines ~292-314)

## Root cause

`fetchCandles` has two data paths controlled by this check (line 666):

```ts
if (toBucketEnd(end, resolution) >= currentTime) {
    // Path A: current-month — fetches open candles, then history
} else {
    // Path B: past-month — history only
}
```

For resolution `"60"` (1H), `toBucketEnd` rounds to `endOf("month")`. So:
- Requests where `end` is in the **current calendar month** take Path A
- Requests where `end` is in a **completed month** take Path B

### Path B (past month) — the bug

History candles are filtered on line 701:

```ts
historyCandles = results[j].filter(({time}) => time.getTime() / 1000 < minTime)
```

`minTime` is initialized to `end` (line 665). The filter is **strict less-than** (`< minTime`), so a candle whose timestamp equals `end` exactly is **excluded**.

The final filter (line 712-714) is inclusive (`current <= end`), but the candle was already dropped at line 701, so it never reaches the final filter.

### Path A (current month) — works correctly

Open candles are fetched and pushed directly to the array (line 673: `candles.push(...openCandles)`). These candles bypass the `< minTime` history filter entirely. If the boundary candle is among the open candles, it survives to the final filter where `current <= end` is **inclusive** — so it's kept.

## Reproduction

Call `fetchCandles` with 1H resolution where `end` falls exactly on an hour boundary.

Tested on 2026-04-08 with symbol BINA_USDT_BTC, resolution `"60"`.
The `end` parameter is a unix timestamp in seconds. Both calls use `end` at the exact hour boundary — only the date differs:

```ts
// FAILS — March 31 is in a past month, boundary candle excluded
coinray.fetchCandles({
  coinraySymbol: 'BINA_USDT_BTC',
  resolution: '60',
  start: /* 500h before end */,
  end: 1774929600, // 2026-03-31T04:00:00Z
})
// Returns 500 bars, last bar at 2026-03-31T03:00Z. The T04:00 bar is missing.

// PASSES — April 1 is in the current month, boundary candle included via open candles
coinray.fetchCandles({
  coinraySymbol: 'BINA_USDT_BTC',
  resolution: '60',
  start: /* 500h before end */,
  end: 1775016000, // 2026-04-01T04:00:00Z
})
// Returns 501 bars, last bar at 2026-04-01T04:00Z. The boundary bar is present.
```

The bug affects all resolutions that use bucket types, not just `"60"`. The bucket boundaries vary by resolution:
- `"1"`, `"2"`, `"3"` — daily buckets
- `"5"`, `"10"`, `"15"` — weekly buckets
- `"30"`, `"60"`, `"120"` — monthly buckets
- `"240"`, `"360"`, `"720"`, `"D"`, `"1D"` — yearly buckets

## Fix

The history filter on line 701 should use `<=` instead of `<`:

```ts
// Before (line 701):
historyCandles = results[j].filter(({time}) => time.getTime() / 1000 < minTime)

// After:
historyCandles = results[j].filter(({time}) => time.getTime() / 1000 <= minTime)
```

This makes the history path consistent with the final filter (`current <= end`) and with the open-candles path. Since `minTime` is initialized to `end` and only decreases, this ensures the boundary candle is included when it exists in the history data.

**Important:** verify that this doesn't introduce duplicate candles when the open-candles path is also active (Path A). The open candle at `minTime` could appear in both `openCandles` and `historyCandles`. If so, deduplicate by timestamp before returning. The existing `minTime` tracking (line 672: `minTime = Math.min(openCandles[0].time.getTime() / 1000, minTime)`) should already prevent this since history is filtered to `< minTime` after `minTime` is lowered by open candles — but this needs verification.
