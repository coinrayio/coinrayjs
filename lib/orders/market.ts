import BaseOrder from "./base";
import {BaseOrderParams, OrderSide, OrderType} from "../types";
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
    if (this.side === OrderSide.BUY) {
      maxQuote = this.balances.quote.available
    } else {
      maxBase = this.balances.base.available;
    }

    return {
      quoteAmount: {
        bigNumericality: {
          greaterThanOrEqualTo: this.minQuote.toNumber(),
          lessThanOrEqualTo: maxBase,
        }
      },
      baseAmount: {
        bigNumericality: {
          greaterThanOrEqualTo: this.minBase.toNumber(),
          lessThanOrEqualTo: maxQuote,
        }
      }
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
