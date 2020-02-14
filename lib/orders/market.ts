import BaseOrder from "./base";
import {BaseOrderParams, OrderType} from "../types";
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
    return {
      quoteAmount: {
        bigNumericality: {
          greaterThan: this.minBaseAmount.toNumber()
        }
      },
      baseAmount: {
        bigNumericality: {
          greaterThan: this.minBaseAmount.toNumber()
        }
      }
    }
  };

  constructor(params: MarketOrderParams) {
    super(params);
    this.quoteAmount = params.quoteAmount;
    this.baseAmount = params.baseAmount
  }

  updateBaseAmount(baseAmount: BigNumber) {
    this.baseAmount = baseAmount
  }

  updateQuoteAmount(quoteAmount: BigNumber) {
    this.quoteAmount = quoteAmount
  }

  getOrders(): Array<BaseOrder> {
    return [this]
  }
}
