"use strict"

import Exchange from "../lib/exchange";

// jest.setTimeout(30000);

import Coinray from "../lib";
import CoinrayCache from "../lib/coinray-cache";

const coinrayToken = ""
const coinray = new Coinray(coinrayToken)
let coinrayCache = new CoinrayCache(coinray)

const exchangesStubData = [
  {
    id: 2,
    name: 'Binance',
    code: 'BINA',
    active: true,
    isFutures: false,
    tradingEnabledFrom: '0.0.1',
    tradingEnabled: true,
    websocket: true,
    logo: 'https://api.coinray.eu/images/logos/bina.png',
    btcVolume: '964644.729001999150',
    usdVolume: '18570163456.177105351577',
    totalMarkets: 1437,
    quoteCurrencies: [
      'BIDR', 'BTC', 'USDT', 'BUSD',
      'BNB',  'ETH', 'TRY',  'EUR',
      'VAI',  'DOT', 'AUD',  'BRL',
      'IDRT', 'RUB', 'GBP',  'NGN',
      'UAH',  'DAI', 'DOGE', 'TRX',
      'XRP'
    ],
    supportedResolutions: [
      '1',   '2',   '3',   '5',
      '10',  '15',  '30',  '60',
      '120', '240', '360', '720',
      'D',   '1D',  '3D',  'W',
      '1W',  '2W',  '1M'
    ],
    supportedOrderTypes: [ 'LIMIT', 'MARKET', 'STOP_LOSS_LIMIT', 'OCO' ],
    supportedFeatures: [ 'orderQuoteAmount' ],
    baseCurrencyDominance: {
    },
    apiKeySettings: {
      extraKeys: false,
      passphraseRequired: false,
      versions: null,
      extraSettings: null
    }
  },
  {
    "id": 102,
    "name": "Uniswap v3",
    "code": "UNI3",
    "active": true,
    "isFutures": false,
    "isDex": true,
    "tradingEnabledFrom": "4.0.1",
    "tradingEnabled": false,
    "websocket": true,
    "logo": "https://api.coinray.eu/images/logos/uni3.png",
    "btcVolume": "9611.748027753453",
    "usdVolume": "185678169.454777297118",
    "totalMarkets": 301,
    "quoteCurrencies": [],
    supportedResolutions: [
      '1', '2', '3', '5',
      '10', '15', '30', '60',
      '120', '240', '360', '720',
      'D', '1D', '3D', 'W',
      '1W', '2W', '1M'
    ],
    "baseCurrencyDominance": {},
    "apiEndpoint": "https://dex.ams.coinray.eu",
    "websocketEndpoint": "https://dex.ams.coinray.eu"
  }
]

beforeAll(async () => {
  console.debug("await coinrayCache.initialize() (with stub data for exchanges endpoint) ...")

  coinray.fetchExchanges = async (): Promise<Array<Exchange>> => {
    const {result: {exchanges}} = { result: { exchanges: exchangesStubData }}
    return exchanges.map((exchange) => Exchange.Create(exchange, coinray))
  }

  await coinrayCache.initialize()
})

afterAll(() => {
  coinray.destroy()
  coinrayCache.destroy()
})

describe("CoinrayCache", () => {
  test("getExchanges() should return 2 exchanges given the data is stubbed", async () => {
    let exchanges = coinrayCache.getExchanges()
    expect(Object.keys(exchanges).length).toEqual(2)
  })

  test("UNI3 markets are filled (it should use the custom dex endpoint)", async () => {
    // coinray.fetchMarkets is called during initialize filling markets
    let markets = coinrayCache.getExchange("UNI3").markets
    expect(Object.keys(markets).length > 10).toBeTruthy()
  })

  test("BINA markets are filled (it should use the default endpoint)", async () => {
    // coinray.fetchMarkets is called during initialize filling markets
    let markets = coinrayCache.getExchange("BINA").markets
    expect(Object.keys(markets).length > 10).toBeTruthy()
  })
})
