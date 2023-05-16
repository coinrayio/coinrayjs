module.exports = {
  "roots": [
    "<rootDir>/lib",
    "<rootDir>/test"
  ],
  "transform": {
    "^.+\\.tsx?$": "ts-jest"
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
  testEnvironment: 'node'
}
