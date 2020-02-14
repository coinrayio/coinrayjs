import BaseOrder from "./base";
import {BaseOrderParams, OrderSide, OrderType} from "../types";
import BigNumber from "bignumber.js";
import LimitOrder, {LimitOrderParams} from "./limit";

interface StopLimitOrderParams extends LimitOrderParams {
  otherPrice: BigNumber
}

export default class StopLimitOrder extends LimitOrder {
  otherPrice: BigNumber;
  orderType = OrderType.STOP_LIMIT;

  constraints() {
    const limitConstraints = super.constraints();
    return {
      ...limitConstraints,
      otherPrice: {
        bigNumericality: {
          greaterThan: 0,
        }
      }
    }
  }

  constructor(params: StopLimitOrderParams) {
    super(params);
    this.otherPrice = params.otherPrice
  }

  updatePrice(price: BigNumber) {
    super.updatePrice(price);
    if (price && this.otherPrice.eq(0)) {
      this.otherPrice = price.multipliedBy(0.95).decimalPlaces(this.precisionPrice > 0 ? this.precisionPrice  : 0)
    }
  }

  updateOtherPrice(otherPrice: BigNumber) {
    this.otherPrice = otherPrice;
    if (otherPrice && this.price.eq(0)) {
      this.price = otherPrice.multipliedBy(1.05).decimalPlaces(this.precisionPrice > 0 ? this.precisionPrice  : 0)
    }
  }
}
