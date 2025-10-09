module.exports = {
  "roots": [
    "<rootDir>/lib",
    "<rootDir>/test"
  ],
  "transform": {
    "^.+\\.ts$": "ts-jest",                // transpile your TS
    "^.+\\.m?jsx?$": "babel-jest",         // transpile ESM deps like uuid
  },
  "testRegex": "(/__tests__/.*|(\\.|/)(test|spec))\\.tsx?$",
  "watchPathIgnorePatterns":  ["<rootDir>/test/exchanges.json", "<rootDir>/node_modules/"],
  "moduleFileExtensions": [
    "ts",
    "tsx",
    "js",
    "jsx",
    "json",
    "node"
  ],
  testEnvironment: "node",
  transformIgnorePatterns: [
    "node_modules/(?!uuid/)", // 👈 tell Jest to transform uuid
  ],

}
