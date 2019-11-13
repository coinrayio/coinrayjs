import forge, {Bytes, pki} from "node-forge"
import axios from "axios"

// const {pki} = forge;

const rootCa = `
-----BEGIN CERTIFICATE-----
MIIDbDCCAlSgAwIBAgIRAOtWGf0q+uO3wJ3+18qWrbMwDQYJKoZIhvcNAQELBQAw
PzELMAkGA1UEBhMCTkwxEDAOBgNVBAoMB0NvaW5yYXkxHjAcBgNVBAMMFUNvaW5y
YXkgLSBkZXZlbG9wbWVudDAeFw0xOTA4MjMxMDQzNDVaFw0xOTEwMjIxMDQzNDVa
MD8xCzAJBgNVBAYTAk5MMRAwDgYDVQQKDAdDb2lucmF5MR4wHAYDVQQDDBVDb2lu
cmF5IC0gZGV2ZWxvcG1lbnQwggEiMA0GCSqGSIb3DQEBAQUAA4IBDwAwggEKAoIB
AQC5LKlk1UU0v16a7VuCDZgMdT2ul7IhLW+enC6kpGEchHKIV+HVJv8QViJoSlsG
vBF5nl8KZI8j3/Q1sw4eP2tn/g5npOSaFyvW0viEXZxYUIQDHh6Kchs+j7/QFKFz
GW2EzGU2LcduKOyCZi2mMQsveZedMuVKQy2nBFuQPr4FW+rsu5mDd+vJqvTZky1j
4TpVeVpnhB1JYgqjZiqs120gcepWL9BjdAXLNrKxN31L5M1w+NYtR81fTyotHLhM
4W154TfxMagxf0k+cgZ7rEJ1FGRvWwUBMBhtVWBuQ4LHioTPW+9629rndrU+alm2
zPkD1B68if9ElaTbXam8sBpfAgMBAAGjYzBhMA8GA1UdEwEB/wQFMAMBAf8wDgYD
VR0PAQH/BAQDAgEGMB0GA1UdDgQWBBQDLlnmATT/o8PhqQgXvfI/Cd+ZpjAfBgNV
HSMEGDAWgBQDLlnmATT/o8PhqQgXvfI/Cd+ZpjANBgkqhkiG9w0BAQsFAAOCAQEA
ZGXkIHzj6TjngoWtI0TV1tYj+P1OSx78K945EgJO6Is8L9JWCupY/CS2F5XcIk5/
sF7R2A6arwHlRZEf35tQ188Tj3N3AWs+3CkSnrCFQwUfzSye37UTlO7IimG1M5EB
gW3Ze6XEPSYsSR5Dv9Z+PAyese/Ajt02/loufxXXjjLoa9FKlPRV/Z/UdVo7J+Gd
mPoadrxUcEPuj8X7wxWpguA5DZanNd7QckioMkRCU+bP0a8KXl1GuobE+Nv0jdYy
yiMAQvwfpG5u9TS5TqJubrH1ArI4nVBMFQxK0tE06RaLAelO/VAwTTejhv0dWuym
nS3wbwtH6ZWBEppXJ0My9Q==
-----END CERTIFICATE-----
`;

axios.get("http://localhost:4567/certificate").then((result) => {
  let {pem} = result.data;
  let ca = pki.certificateFromPem(rootCa);
  let cert = pki.certificateFromPem(pem);
  ca.verify(cert);


  let publicKey = <pki.rsa.PublicKey>cert.publicKey;
  let apiKey = {apiKey: "apiKey", secret: "secret"};
  let params = {type: "CreateOrder", size: "10"};

  const key = forge.random.getBytesSync(32);
  const iv = forge.random.getBytesSync(16);
  const ivKey: Bytes = iv + key;
  let encryptedSecret = forge.util.encode64(publicKey.encrypt(ivKey, "RSA-OAEP"));

  const cipher = forge.cipher.createCipher("AES-CBC", key);
  cipher.start({iv: iv});
  cipher.update(forge.util.createBuffer(JSON.stringify(apiKey)));
  cipher.finish();
  let encryptedApiKey = cipher.output.toHex();

  const hmac = forge.hmac.create();
  hmac.start("sha256", ivKey);
  hmac.update(JSON.stringify(params));

  let signature = hmac.digest().toHex();

  let payload = {
    encryptedApiKey,
    encryptedSecret,
    signature,
    params
  };

  axios.post("http://localhost:4567/verify", {
    method: "POST",
    body: JSON.stringify(payload)
  }).then((result) => {
    console.log(result)
  })
});
