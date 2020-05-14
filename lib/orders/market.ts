import BaseOrder from "./base";
import {BalanceLimit, BaseOrderParams, OrderType} from "../types";
import BigNumber from "bignumber.js";


interface MarketOrderParams extends BaseOrderParams {
  quoteAmount?: BigNumber,
  baseAmount?: BigNumber,
}

export default class MarketOrder extends BaseOrder {
  baseAmount?: BigNumber;
  quoteAmount?: BigNumber;
  orderType = OrderType.MARKET;

  constraints = () => {
    let maxBase = undefined;
    let maxQuote = undefined;
    if (this.balanceLimit === BalanceLimit.QUOTE) {
      maxQuote = this.balances.quote || 0
    } else if (this.balanceLimit === BalanceLimit.BASE) {
      maxBase = this.balances.base || 0
    }

    return {
      baseAmount: {
        bigNumericality: {
          greaterThanOrEqualTo: this.minBase.toNumber(),
          lessThanOrEqualTo: maxBase ? maxBase.toNumber() : undefined,
        }
      },
      quoteAmount: {
        bigNumericality: {
          greaterThanOrEqualTo: this.minQuote.toNumber(),
          lessThanOrEqualTo: maxQuote ? maxQuote.toNumber() : undefined,
        }
      },
    }
  };

  constructor(params: MarketOrderParams) {
    super(params);
    this.updateQuoteAmount(params.quoteAmount);
    this.updateBaseAmount(params.baseAmount);
  }

  updateBaseAmount(baseAmount: BigNumber) {
    this.baseAmount = baseAmount;
    this.validate()
  }

  updateQuoteAmount(quoteAmount: BigNumber) {
    this.quoteAmount = quoteAmount;
    this.validate()
  }

  getOrders(): Array<BaseOrder> {
    return [this]
  }
}
