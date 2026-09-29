# Version 2.0.18
- CoinrayCache: only exchanges in use are refreshed every 30s via the batched GET /api/v1/tickers endpoint; others are loaded once at startup and refreshed on demand
- CoinrayCache: new setActiveExchanges, touchExchange, ensureFresh and getActiveExchanges; marketsUpdated now carries {exchangeCodes}
- CoinrayCache: static market data revalidated every 10 minutes via GET /api/v1/markets/static with ETag/304; markets updated in place instead of recreated
- Falls back to the old /markets reload when the new endpoints are unavailable
- Market.applySnapshot and Market.assignStatic; Exchange.update and Exchange.mergeStatic
- Fix websocket ticker volumes: baseVolume/quoteVolume now hold 24h volume (BV/QV), 1s values moved to baseVolume1s/quoteVolume1s; updateTicker applies volumes
- Fix TickerSubscriptions.unsubscribeAll clearing other listeners' pending additions

# Version 2.0.11
- Add FuturesSettings type and parsing on Market (tenor, margin, expiresAt, fundingIntervalSeconds, maxLeverage, groupName)
- Add Market.groupName convenience getter
- filterMarkets: skip markets where the queried property is null/undefined instead of throwing (enables filtering on optional fields like groupName)

# Version 1.5.1
- Remove the last candle fetch on fetch candles
- Added getCurrencyPrice
- Added getUsdPrice

# Version 1.1.0
- Change times to Date objects
- Change OrderBook, Trade number to BigNumbers
- rename Orderbook to OrderBook
- Added CoinrayCache - Caches results where possible. Limits to 30 symbols and resolutions and 2000 candles per symbol
- Added CurrentMarket - Allows to subscribe to a CurrentMarket view. On symbol changes, new snapshots will be broadcasted.
 

# Version 1.0.18
- Initial version of the change log
