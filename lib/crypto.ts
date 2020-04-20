export let crypto;

try {
  // Use node-jose if installed
  const {JWE, JWK, util} = require("node-jose");
  crypto = {
    createJWT: async (payload: {}) => {
      // @ts-ignore
      const header = util.base64url.encode(JSON.stringify({typ: "JWT", alg: "none"}));
      const body = util.base64url.encode(JSON.stringify(payload));
      return [header, body, ""].join(".")
    },

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
    createJWT: (payload: {}) => {
      // @ts-ignore
      const base64 = new Jose.Utils.Base64Url();
      const header = base64.encode(JSON.stringify({typ: "JWT", alg: "none"}));
      const body = base64.encode(JSON.stringify(payload));
      return [header, body, ""].join(".")
    },

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
