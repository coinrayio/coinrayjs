import {OrderSide, OrderType} from "../types";
import BigNumber from "bignumber.js";
import LimitOrder, {LimitOrderParams} from "./limit";
import {safeBigNumber, safeFloat} from "../util";

interface OcoOrderParams extends LimitOrderParams {
  linkedOrderId: string,
  otherPrice: BigNumber,
  stopPrice: BigNumber,
  priceOffset: number,
}

export default class OcoOrder extends LimitOrder {
  linkedOrderId: string;
  otherPrice: BigNumber;
  stopPrice: BigNumber;
  priceOffset: number;
  orderType = OrderType.OCO;

  constraints() {
    const limitConstraints = super.constraints();
    return {
      ...limitConstraints,
      otherPrice: {
        bigNumericality: {
          greaterThan: 0,
        }
      },
      stopPrice: {
        bigNumericality: {
          greaterThan: 0,
        }
      }
    }
  }

  constructor(params: OcoOrderParams) {
    super(params);
    this.otherPrice = safeBigNumber(params.otherPrice);
    this.stopPrice = safeBigNumber(params.stopPrice);
    this.priceOffset = safeFloat(params.priceOffset) || 0.05
  }

  updatePrice(price: BigNumber) {
    super.updatePrice(price);
    if (price && this.otherPrice.eq(0)) {
      const offset = this.side === OrderSide.BUY ? 1 + (this.priceOffset * 2) : 1 - (this.priceOffset * 2);
      const stopOffset = this.side === OrderSide.BUY ? 1 + this.priceOffset : 1 - this.priceOffset;

      this.otherPrice = price.multipliedBy(offset).decimalPlaces(this.precisionPrice > 0 ? this.precisionPrice : 0);
      this.stopPrice = price.multipliedBy(stopOffset).decimalPlaces(this.precisionPrice > 0 ? this.precisionPrice : 0)
    }
  }

  updateOtherPrice(otherPrice: BigNumber) {
    this.otherPrice = otherPrice.decimalPlaces(this.precisionPrice);
    if (otherPrice && this.price.eq(0)) {
      const offset = this.side === OrderSide.BUY ? 1 - (this.priceOffset * 2) : 1 + (this.priceOffset * 2);
      const stopOffset = this.side === OrderSide.BUY ? 1 - this.priceOffset : 1 + this.priceOffset;

      this.price = otherPrice.multipliedBy(offset).decimalPlaces(this.precisionPrice > 0 ? this.precisionPrice : 0);
      this.stopPrice = otherPrice.multipliedBy(stopOffset).decimalPlaces(this.precisionPrice > 0 ? this.precisionPrice : 0)
    }
  }

  updateStopPrice(stopPrice: BigNumber) {
    this.stopPrice = stopPrice.decimalPlaces(this.precisionPrice);
    if (stopPrice && this.price.eq(0)) {
      const offset = this.side === OrderSide.BUY ? 1 - this.priceOffset : 1 + this.priceOffset ;
      const otherOffset = this.side === OrderSide.BUY ? 1 + this.priceOffset : 1 - this.priceOffset;

      this.price = stopPrice.multipliedBy(offset).decimalPlaces(this.precisionPrice > 0 ? this.precisionPrice : 0);
      this.otherPrice = stopPrice.multipliedBy(otherOffset).decimalPlaces(this.precisionPrice > 0 ? this.precisionPrice : 0);
    }
  }
}
