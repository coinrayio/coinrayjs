import {hmac, md} from "node-forge";
import _, {camelCase} from "lodash"
import BigNumber from "bignumber.js";
import {MarketMap, MarketQuery} from "./types";
import {crypto} from "./crypto";
import {base64url} from "rfc4648";

export const MINUTES = 60;
export const HOURS = 60 * MINUTES;
export const DAYS = 24 * HOURS;


export function unix() {
  return new Date().getTime() / 1000
}

export function strToArray(str) {
  return str.split('').map((char) => char.charCodeAt(0))
}

export function base64UrlEncode(str) {
  return base64url.stringify(strToArray(str), {pad: false})
}

export function base64UrlDecode(str) {
  return String.fromCharCode.apply(null, base64url.parse(str, {loose: true}))
}

export function sha256hexdigest(str) {
  const digest = md.sha256.create();
  digest.update(str);
  return digest.digest().toHex();
}

export function signHMAC(dataToSign, secret, format = "hex") {
  const digest = hmac.create();
  digest.start("sha256", secret);
  digest.update(dataToSign);
  const result = digest.digest()

  switch (format) {
    case "base64url":
      return base64UrlEncode(result.data)
    default:
      return result.toHex()
  }
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
      } catch(error) {
        // Do nothing
      }
    }
    const keywords = query.toLowerCase().split(/[\s]+/).filter(Boolean);
    filteredMarkets = _.pickBy(filteredMarkets, (market, key) => {
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
