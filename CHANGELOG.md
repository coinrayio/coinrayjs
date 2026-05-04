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
