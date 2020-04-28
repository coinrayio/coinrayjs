import BaseOrder from "./base";
import {BaseOrderParams, OrderSide, OrderType} from "../types";
import BigNumber from "bignumber.js";
import {safeBigNumber} from "../util";

export interface LimitOrderParams extends BaseOrderParams {
  baseAmount: BigNumber
  quoteAmount: BigNumber
  price: BigNumber
  lockedOn: string
}

export default class LimitOrder extends BaseOrder {
  baseAmount: BigNumber;
  quoteAmount: BigNumber;
  price: BigNumber;
  lockedOn: string;

  orderType = OrderType.LIMIT;

  constraints() {
    let maxBase = undefined;
    let maxQuote = undefined;
    if (this.side === OrderSide.BUY) {
      maxQuote = this.balances.quote || 0
    } else {
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
      price: {
        bigNumericality: {
          greaterThan: 0,
        }
      }
    }
  }

  constructor(params: LimitOrderParams) {
    super(params);
    this.price = safeBigNumber(params.price || "0");
    this.lockedOn = params.lockedOn;
    this.baseAmount = safeBigNumber(params.baseAmount);
    this.quoteAmount = safeBigNumber(params.quoteAmount);

    if (this.quoteAmount.gt(0) && this.lockedOn === "quoteAmount") {
      this.updateQuoteAmount(this.quoteAmount)
    } else {
      this.updateBaseAmount(this.baseAmount)
    }
  }

  updateBaseAmount(baseAmount: BigNumber) {
    this.baseAmount = baseAmount;
    this.quoteAmount = this.price.multipliedBy(this.baseAmount).decimalPlaces(this.precisionQuote > 0 ? this.precisionQuote : 0, BigNumber.ROUND_DOWN);
    this.validate()
  }

  updateQuoteAmount(quoteAmount: BigNumber) {
    this.quoteAmount = quoteAmount;
    this.baseAmount = quoteAmount.dividedBy(this.price).decimalPlaces(this.precisionBase > 0 ? this.precisionBase : 0, BigNumber.ROUND_DOWN );
    this.validate()
  }

  updateLockedOn(lockedOn: string) {
    this.lockedOn = lockedOn;
    this.validate()
  }

  quoteFee() {
    return this.quoteAmount.multipliedBy(this.takerFee)
  }

  updatePrice(price: BigNumber) {
    this.price = price.decimalPlaces(this.precisionPrice);

    if (this.lockedOn === "baseAmount") {
      this.updateBaseAmount(this.baseAmount)
    } else {
      this.updateQuoteAmount(this.quoteAmount)
    }
  }

  getOrders(): Array<BaseOrder> {
    return [this]
  }
}
