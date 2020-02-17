import BaseOrder from "./base";
import {BaseOrderParams, OrderType} from "../types";
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
    return {
      baseAmount: {
        bigNumericality: {
          greaterThan: this.minBaseAmount.toNumber(),
        }
      },
      quoteAmount: {
        bigNumericality: {
          greaterThan: 0,
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

  recalculate() {
    if (this.lockedOn === "baseAmount") {
      this.updateBaseAmount(this.baseAmount)
    } else {
      this.updateQuoteAmount(this.quoteAmount)
    }
  }

  updateBaseAmount(baseAmount: BigNumber, setLockedOn = true) {
    this.baseAmount = baseAmount;
    this.quoteAmount = this.price.multipliedBy(this.baseAmount).decimalPlaces(this.precisionPrice > 0 ? this.precisionPrice : 0);
  }

  updateQuoteAmount(quoteAmount: BigNumber, setLockedOn = true) {
    this.quoteAmount = quoteAmount;

    this.baseAmount = quoteAmount.dividedBy(this.price).decimalPlaces(this.precisionAmount > 0 ? this.precisionAmount : 0);
  }

  updateLockedOn(lockedOn: string) {
    this.lockedOn = lockedOn
  }

  quoteFee() {
    return this.quoteAmount.multipliedBy(this.takerFee)
  }

  updatePrice(price: BigNumber) {
    this.price = price;

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
