// --- base64url helpers without external deps ---
function toBase64Url(b64: string): string {
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}
function fromBase64Url(b64url: string): string {
  const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/');
  const pad = b64.length % 4 === 0 ? '' : '='.repeat(4 - (b64.length % 4));
  return b64 + pad;
}
function u8ToB64(u8: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < u8.length; i++) bin += String.fromCharCode(u8[i]);
  return btoa(bin);
}
function b64ToU8(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
import _, {camelCase} from "lodash"
import BigNumber from "bignumber.js";
import {MarketMap, MarketQuery} from "./types";
import {crypto} from "./crypto";
import moment, {Moment} from "moment";

export const MINUTES = 60;
export const HOURS = 60 * MINUTES;
export const DAYS = 24 * HOURS;
export const WEEK = 7 * DAYS;


export function unix() {
  return new Date().getTime() / 1000
}

export function strToArray(str) {
  return str.split('').map((char) => char.charCodeAt(0))
}


export function base64UrlEncode(str) {
  const bytes = new TextEncoder().encode(str);
  return toBase64Url(u8ToB64(bytes));
}

export function base64UrlDecode(str) {
  const u8 = b64ToU8(fromBase64Url(str));
  return new TextDecoder().decode(u8);
}

export async function sha256hexdigest(str) {
  const data = new TextEncoder().encode(str);
  const digest = await crypto.subtle.digest('SHA-256', data);
  const bytes = new Uint8Array(digest);
  let hex = '';
  for (let i = 0; i < bytes.length; i++) hex += bytes[i].toString(16).padStart(2, '0');
  return hex;
}

export async function signHMAC(dataToSign, secret, format = 'hex') {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(dataToSign));
  const bytes = new Uint8Array(sig);

  if (format === 'base64url') {
    return toBase64Url(u8ToB64(bytes));
  }
  let hex = '';
  for (let i = 0; i < bytes.length; i++) hex += bytes[i].toString(16).padStart(2, '0');
  return hex;
}

export function createJWT(payload: {}, secret = undefined) {
  return crypto.createJWT(payload, secret)
}

export function parseJWT(jwt) {
  return crypto.parseJWT(jwt)
}

export function jwkToPublicKey(jwk) {
  return crypto.jwkToPublicKey(jwk)
}

export function encryptPayload(payload, publicKey) {
  return crypto.encryptPayload(payload, publicKey)
}

export function camelize(value) {
  if (Array.isArray(value)) {
    return value.map(camelize);
  }

  if (value && typeof value === 'object' && value.constructor === Object) {
    const obj = {};
    const keys = Object.keys(value);
    const len = keys.length;

    for (let i = 0; i < len; i += 1) {
      obj[camelCase(keys[i])] = camelize(value[keys[i]]);
    }

    return obj;
  }

  return value;
}

export function jwtExpired(token: string) {
  if (!token) {
    return true
  }

  try {
    let jwt = JSON.parse(base64UrlDecode(token.split(".")[1]));
    return jwt.exp < unix()
  } catch (error) {
    return true
  }
}


export function throwNull2NonNull(d: any): never {
  return errorHelper("root", d, "non-nullable object", false);
}

export function throwNotObject(d: any, nullable: boolean): never {
  return errorHelper("root", d, "object", nullable);
}

export function throwIsArray(d: any, nullable: boolean): never {
  return errorHelper("root", d, "object", nullable);
}

export function checkArray(d: any, field: string): void {
  if (!Array.isArray(d) && d !== null && d !== undefined) {
    errorHelper(field, d, "array", true);
  }
}

export function checkNumber(d: any, nullable: boolean, field: string): void {
  if (typeof (d) === 'string') {
    if (!d.match(/\d+(\.\d+)?/)) {
      errorHelper(field, d, "string", nullable);
    }
  } else if (typeof (d) !== 'number' && (!nullable || (nullable && d !== null && d !== undefined))) {
    errorHelper(field, d, "number", nullable);
  }
}

export function checkBigNumber(d: any, nullable: boolean, field: string): void {
  if (typeof (d) === 'string') {
    if (!d.match(/\d+(\.\d+)?/)) {
      errorHelper(field, d, "number", nullable);
    }
  } else if (typeof (d) !== 'number' && (!nullable || (nullable && d !== null && d !== undefined))) {
    errorHelper(field, d, "number", nullable);
  }
}

export function checkBoolean(d: any, nullable: boolean, field: string): void {
  if (typeof (d) !== 'boolean' && (!nullable || (nullable && d !== null && d !== undefined))) {
    errorHelper(field, d, "boolean", nullable);
  }
}

export function checkString(d: any, nullable: boolean, field: string): void {
  if (typeof (d) !== 'string' && (!nullable || (nullable && d !== null && d !== undefined))) {
    errorHelper(field, d, "string", nullable);
  }
}

export function checkNull(d: any, field: string): void {
  if (d !== null && d !== undefined) {
    errorHelper(field, d, "null or undefined", false);
  }
}

export function errorHelper(field: string, d: any, type: string, nullable: boolean): never {
  if (nullable) {
    type += ", null, or undefined";
  }
  throw new TypeError('Expected ' + type + " at " + field + " but found:\n" + JSON.stringify(d));
}

export function safeBigNumber(d: string | number | BigNumber): BigNumber {
  if (BigNumber.isBigNumber(d)) {
    return d
  } else if (!d) {
    return new BigNumber("0")
  }
  return new BigNumber(d)
}

export function correctNumberPrecision(precision, value) {
  return new BigNumber(value).toFixed(precision > 0 ? precision : 0)
}

export function safeFloat(d: string | number): number {
  if (typeof (d) === 'number') {
    return d
  } else {
    return parseFloat(d)
  }
}

export function safeInteger(d: string | number): number {
  if (typeof (d) === 'number') {
    return d
  } else {
    return parseInt(d)
  }
}

export function safeTime(d: string | number): Date {
  let time = safeFloat(d);
  if (time < (10 ** 10)) {
    time = time * 1000
  }
  return new Date(time)
}


export function resolutionToDuration(resolution: String): number {
  switch (resolution.toString().toUpperCase()) {
    case "1S":
      return 1
    case "2S":
      return 2
    case "3S":
      return 3
    case "5S":
      return 5
    case "10S":
      return 10
    case "15S":
      return 15
    case "30S":
      return 30
    case "1":
      return MINUTES
    case "2":
      return MINUTES * 2
    case "3":
      return MINUTES * 3
    case "5":
      return MINUTES * 5
    case "10":
      return MINUTES * 10
    case "15":
      return MINUTES * 15
    case "30":
      return MINUTES * 30
    case "60":
      return MINUTES * 60
    case "120":
      return MINUTES * 120
    case "240":
      return MINUTES * 240
    case "360":
      return MINUTES * 360
    case "720":
      return MINUTES * 720
    case "D":
    case "1D":
      return DAYS
    case "3D":
      return DAYS * 3
    case "W":
      return WEEK
    case "1W":
      return WEEK
    case "2W":
      return WEEK * 2
    case "1M":
      return DAYS * 30
  }
}

export const toSafeDate = (timeOrDate) => {
  return typeof timeOrDate === "object" ? timeOrDate : new Date(timeOrDate * 1000)
}

export const toBucketEnd = (date, resolution) => {
  date = moment.utc(toSafeDate(date))
  switch (resolution) {
    case "1":
    case "2":
    case "3":
      return date.endOf("day").unix()
    case "5":
    case "10":
    case "15":
      return date.endOf("isoWeek").unix()
    case "30":
    case "60":
    case "120":
      return date.endOf("month").unix()
    case "240":
    case "360":
    case "720":
    case "D":
    case "1D":
      return date.endOf("year").unix()
  }
}

export const toBucketStart = (date, resolution) => {
  date = moment.utc(toSafeDate(date))
  switch (resolution) {
    case "1":
    case "2":
    case "3":
      return date.startOf("day").unix()
    case "5":
    case "10":
    case "15":
      return date.startOf("isoWeek").unix()
    case "30":
    case "60":
    case "120":
      return date.startOf("month").unix()
    case "240":
    case "360":
    case "720":
    case "D":
    case "1D":
      return date.startOf("year").unix()
  }
}

export function resolutionToBucketType(resolution): "day" | "week" | "month" | "year" {
  switch (resolution) {
    case "1":
    case "2":
    case "3":
      return "day"
    case "5":
    case "10":
    case "15":
      return "week"
    case "30":
    case "60":
    case "120":
      return "month"
    case "240":
    case "360":
    case "720":
    case "D":
    case "1D":
      return "year"
    default:
      throw new Error(`Unsupported resolution: ${resolution}`)
  }
}

export function getTimeParams(bucketType : String, date : any)  {
  let momentDate = moment(toSafeDate(date))
  let timeParams: { year: number; month?: number; day?: number; week?: number; }
  switch (bucketType) {
    case "day":
      timeParams = {year: momentDate.year(), month: momentDate.month() + 1, day: momentDate.date()}
      break
    case "week":
      timeParams = {year: momentDate.isoWeekYear(), week: momentDate.isoWeek()}
      break
    case "month":
      timeParams = {year: momentDate.year(), month: momentDate.month() + 1}
      break
    case "year":
      timeParams = {year: momentDate.year()}
      break
    default:
      throw new Error(`Unsupported bucketType: ${bucketType}`)
  }
  return timeParams
}

export function getBucketStartDates(startTime: number, endTime: number, bucketType: "day" | "week" | "month" | "year"): Array<Moment> {
  const dates = []
  let current = moment.utc(endTime * 1000)

  const toBucketStart = (date) => {
    switch (bucketType) {
      case "day":
        return date.startOf("day")
      case "week":
        return date.startOf("isoWeek")
      case "month":
        return date.startOf("month")
      case "year":
        return date.startOf("year")
      default:
        throw new Error(`Unsupported bucketType: ${bucketType}`)
    }
  }

  const decrementBucket = (date) => {
    switch (bucketType) {
      case "day":
        return date.subtract(1, "day")
      case "week":
        return date.subtract(1, "week")
      case "month":
        return date.subtract(1, "month")
      case "year":
        return date.subtract(1, "year")
      default:
        throw new Error(`Unsupported bucketType: ${bucketType}`)
    }
  }

  let bucketStart = toBucketStart(current)
  const startMoment = toBucketStart(moment.utc(startTime * 1000))
  while (bucketStart >= startMoment) {
    dates.push(bucketStart.clone())
    bucketStart = decrementBucket(bucketStart)
  }

  return dates
}

export function candleTime(slotsAgo: number, resolution: String, date: number | Date): number {
  let timeSpan = resolutionToDuration(resolution)
  let time = typeof date === "object" ? date.getTime() / 1000 : date

  return (Math.floor(time / timeSpan) * timeSpan) - (timeSpan * (slotsAgo - 1))

}

export function filterMarkets(markets: MarketMap, marketQuery: string | MarketQuery | (string | MarketQuery)[]) {
  let queries: MarketQuery[] = marketQuery as MarketQuery[];
  if (typeof (marketQuery) === "string") {
    queries = [{query: marketQuery, marketProperty: "fullDisplayName"}]
  } else if (!Array.isArray(marketQuery)) {
    queries = [marketQuery as MarketQuery]
  } else {
    queries = marketQuery.map((q) => {
      if (typeof (q) === "string") {
        return {query: q, marketProperty: "fullDisplayName"}
      } else if (!Array.isArray(q)) {
        return q
      }
    })
  }

  if (queries.length === 0 || !queries.find(({query}) => !!query && !!query.length)) {
    return markets
  }

  let filteredMarkets = markets;

  queries.forEach(({query, marketProperty}) => {
    let matcher
    if (query.match(/[-_:\/\\]+/)) {
      try {
        matcher = new RegExp(query.replace(/\*/g, ".*"), "i");
      } catch (error) {
        // Do nothing
      }
    }
    const keywords = query.toLowerCase().split(/[\s]+/).filter(Boolean);
    filteredMarkets = _.pickBy(filteredMarkets, (market, _) => {
      const matchTo = market[marketProperty].toLowerCase();

      if (matcher && marketProperty === "fullDisplayName") {
        return !!matcher.exec(market[marketProperty])
      }

      return keywords.filter((keyword) => {
        return matchTo.includes(keyword)
      }).length === keywords.length
    })
  });

  return filteredMarkets
}
