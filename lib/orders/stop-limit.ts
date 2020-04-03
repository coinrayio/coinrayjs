import BaseOrder from "./base";
import {BaseOrderParams, OrderSide, OrderType} from "../types";
import BigNumber from "bignumber.js";
import LimitOrder, {LimitOrderParams} from "./limit";
import {safeBigNumber} from "../util";

interface StopLimitOrderParams extends LimitOrderParams {
  stopPrice: BigNumber
}

export default class StopLimitOrder extends LimitOrder {
  stopPrice: BigNumber;
  orderType = OrderType.STOP_LOSS_LIMIT;

  constraints() {
    const limitConstraints = super.constraints();
    return {
      ...limitConstraints,
      stopPrice: {
        bigNumericality: {
          greaterThan: 0,
        }
      }
    }
  }

  constructor(params: StopLimitOrderParams) {
    super(params);
    this.stopPrice = safeBigNumber(params.stopPrice)
  }

  updatePrice(price: BigNumber) {
    super.updatePrice(price);
    if (price && this.stopPrice.eq(0)) {
      this.stopPrice = price.multipliedBy(0.99).decimalPlaces(this.precisionPrice > 0 ? this.precisionPrice  : 0)
    }
  }

  updateStopPrice(stopPrice: BigNumber) {
    this.stopPrice = stopPrice.decimalPlaces(this.precisionPrice);
    if (stopPrice && this.price.eq(0)) {
      this.price = stopPrice.multipliedBy(1.01).decimalPlaces(this.precisionPrice > 0 ? this.precisionPrice  : 0)
    }
  }
}
