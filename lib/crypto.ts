export let crypto;

try {
  // Use node-jose if installed
  const {JWE, JWK, util} = require("node-jose");

  const urlSafeBase64encode = (payload) => {
    return util.base64url.encode(payload)
  }

  crypto = {
    urlSafeBase64encode,

    createJWT: async (payload: {}) => {
      const header = urlSafeBase64encode(JSON.stringify({typ: "JWT", alg: "none"}));
      const body = urlSafeBase64encode(JSON.stringify(payload));
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
  const base64 = new Jose.Utils.Base64Url();

  const urlSafeBase64encode = (payload) => {
    return base64.encode(payload)
  }

  crypto = {
    urlSafeBase64encode,

    createJWT: (payload: {}) => {
      const header = urlSafeBase64encode(JSON.stringify({typ: "JWT", alg: "none"}));
      const body = urlSafeBase64encode(JSON.stringify(payload));
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
