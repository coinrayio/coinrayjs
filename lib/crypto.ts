import {base64UrlDecode, base64UrlEncode, sha256hexdigest, signHMAC} from "./util";
import { importJWK, CompactEncrypt } from 'jose';

export let crypto;

crypto = {
  jwkToPublicKey: async (jwk: JsonWebKey) => {
    // Import an RSA public key for RSA-OAEP using Web Crypto (browser)
    return await importJWK(jwk, 'RSA-OAEP');
  },

  encryptPayload: async (jwt: string, publicKey: CryptoKey) => {
    // Create a compact JWE using RSA-OAEP + A256GCM
    const plaintext = new TextEncoder().encode(jwt);
    return await new CompactEncrypt(plaintext)
      .setProtectedHeader({ alg: 'RSA-OAEP', enc: 'A256GCM' })
      .encrypt(publicKey);
  }
};

crypto.createJWT = async (payload: {}, secret = undefined) => {
  const body = base64UrlEncode(JSON.stringify(payload));

  let signature, header = ""
  if (secret) {
    header = base64UrlEncode(JSON.stringify({"typ": "JWT", "kid": sha256hexdigest(secret), "alg": "HS256"}));
    const dataToSign = [header, body].join(".")
    signature = signHMAC(dataToSign, secret, "base64url")
  } else {
    header = base64UrlEncode(JSON.stringify({"typ": "JWT", "alg": "none"}));
  }

  return [header, body, signature].join(".")
}

crypto.parseJWT = (jwt) => {
  const [headerString, bodyString, signature] = jwt.split(".")
  const header = JSON.parse(base64UrlDecode(headerString));
  const body = JSON.parse(base64UrlDecode(bodyString));

  return {header, body, signature}
}
