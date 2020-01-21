import Coinray from "./coinray";
import LRU from "./lru";
import {Candle} from "./types";
import _ from "lodash"

class Range {
  private candles: Candle[];
  private start: number;
  private end: number;

  constructor() {
    this.candles = [];
  }

  update(candles) {
    this.candles = _.takeRight(_.uniqBy(this.candles.concat(candles), 'time').sort((a, b) => a.time > b.time ? 1 : -1), 2000);

    if (this.candles.length > 0) {
      this.start = this.candles[0].time.getTime();
      this.end = this.candles[this.candles.length - 1].time.getTime();
    } else {
      this.start = null;
      this.end = null;
    }
  }

  excludes(start, end) {
    return !this.start || this.start > start ||
        !this.end || this.end < end
  }

  get(start, end) {
    return this.candles.filter(({time}) => time >= start && time <= end)
  }
}

export default class CandlesCache {
  private lru: LRU;
  private api: Coinray;

  constructor(limit, api: Coinray) {
    this.lru = new LRU(limit);
    this.api = api
  }

  async load(coinraySymbol: string, start: number, end: number, resolution: string) {
    const key = [coinraySymbol, resolution].join("-");
    let range = this.lru.read(key) || new Range();

    if (range.excludes(start, end)) {
      const candles = await this.api.fetchCandles({coinraySymbol, start, end, resolution});
      range.update(candles);
      return candles;
    }

    return range.get(start, end)
  }
}
