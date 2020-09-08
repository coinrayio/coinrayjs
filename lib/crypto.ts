import {base64UrlDecode, base64UrlEncode, sha256hexdigest, signHMAC} from "./util";

export let crypto;

try {
  // Use node-jose if installed
  const {JWE, JWK} = require("node-jose");
  crypto = {
    jwkToPublicKey: (jwk) => {
      return JWK.asKey(jwk);
    },

    encryptPayload: (jwt, publicKey) => {
      return JWE.createEncrypt({compact: true}, {key: publicKey}).final(jwt, "utf8")
    }
  };
} catch (e) {
  // Use jose-jwe-jwe if installed
  const {Jose} = require("jose-jwe-jws");

  crypto = {
    jwkToPublicKey: (jwk) => {
      return Jose.Utils.importRsaPublicKey(jwk, "RSA-OAEP");
    },

    encryptPayload: (jwt, publicKey) => {
      var cryptographer = new Jose.WebCryptographer();
      var encrypter = new Jose.JoseJWE.Encrypter(cryptographer, publicKey);
      return encrypter.encrypt(jwt);
    }
  };
}

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
