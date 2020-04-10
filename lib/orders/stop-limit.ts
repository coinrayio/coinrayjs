import {OrderSide, OrderType} from "../types";
import BigNumber from "bignumber.js";
import LimitOrder, {LimitOrderParams} from "./limit";
import {safeBigNumber, safeFloat} from "../util";

interface StopLimitOrderParams extends LimitOrderParams {
  stopPrice: BigNumber,
  priceOffset: number
}

export default class StopLimitOrder extends LimitOrder {
  stopPrice: BigNumber;
  priceOffset: number;
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
    this.stopPrice = safeBigNumber(params.stopPrice);
    this.priceOffset = safeFloat(params.priceOffset) || 0.05
  }

  updatePrice(price: BigNumber) {
    super.updatePrice(price);

    if (price && this.stopPrice.eq(0)) {
      const offset = this.side === OrderSide.BUY ? 1 - this.priceOffset : 1 + this.priceOffset;
      this.stopPrice = price.multipliedBy(offset).decimalPlaces(this.precisionPrice > 0 ? this.precisionPrice : 0)
    }
  }

  updateStopPrice(stopPrice: BigNumber) {
    this.stopPrice = stopPrice.decimalPlaces(this.precisionPrice);
    if (stopPrice && this.price.eq(0)) {
      const offset = this.side === OrderSide.BUY ? 1 + this.priceOffset : 1 - this.priceOffset;
      this.price = stopPrice.multipliedBy(offset).decimalPlaces(this.precisionPrice > 0 ? this.precisionPrice : 0)
    }
  }
}
