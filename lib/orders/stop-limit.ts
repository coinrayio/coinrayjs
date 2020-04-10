import {OrderSide, OrderType} from "../types";
import BigNumber from "bignumber.js";
import LimitOrder, {LimitOrderParams} from "./limit";
import {safeBigNumber, safeFloat} from "../util";

interface StopLimitOrderParams extends LimitOrderParams {
  stopPrice: BigNumber,
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
    this.stopPrice = safeBigNumber(params.stopPrice);
  }

  updatePrice(price: BigNumber, priceOffset = 0.05) {
    super.updatePrice(price);

    if (price && this.stopPrice.eq(0)) {
      const offset = this.side === OrderSide.BUY ? 1 - priceOffset : 1 + priceOffset;
      this.stopPrice = price.multipliedBy(offset).decimalPlaces(this.precisionPrice > 0 ? this.precisionPrice : 0)
    }
  }

  updateStopPrice(stopPrice: BigNumber, priceOffset = 0.05) {
    this.stopPrice = stopPrice.decimalPlaces(this.precisionPrice);
    if (stopPrice && this.price.eq(0)) {
      const offset = this.side === OrderSide.BUY ? 1 + priceOffset : 1 - priceOffset;
      this.price = stopPrice.multipliedBy(offset).decimalPlaces(this.precisionPrice > 0 ? this.precisionPrice : 0)
    }
  }
}
