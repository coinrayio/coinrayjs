import {JWS, JWE, JWK, util} from "node-jose";
import {hmac} from "node-forge";
import {camelCase} from "lodash"

export const MINUTES = 60;
export const HOURS = 60 * MINUTES;
export const DAYS = 24 * HOURS;


export function unix() {
  return new Date().getTime() / 1000
}

export function signHMAC(dataToSign, secret) {
  const digest = hmac.create();
  digest.start("sha256", secret);
  digest.update(dataToSign);
  return digest.digest().toHex();
}

export async function createJWT(payload: {}) {
  const header = util.base64url.encode(JSON.stringify({typ: "JWT", alg: "none"}));
  const body = util.base64url.encode(JSON.stringify(payload));
  return [header, body, ""].join(".")
}

export async function encryptPayload(payload, jwk) {
  return JWE.createEncrypt({compact: true}, {key: jwk}).final(payload, "utf8");
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
    let jwt = JSON.parse(atob(token.split(".")[1]));
    return jwt.exp < unix() - 15 * MINUTES
  } catch (error) {
    return true
  }
}
