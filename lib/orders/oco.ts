import {OrderType} from "../types";
import BigNumber from "bignumber.js";
import LimitOrder, {LimitOrderParams} from "./limit";
import {safeBigNumber} from "../util";

interface OcoOrderParams extends LimitOrderParams {
  linkedOrderId: string,
  otherPrice: BigNumber,
  stopPrice: BigNumber
}

export default class OcoOrder extends LimitOrder {
  linkedOrderId: string;
  otherPrice: BigNumber;
  stopPrice: BigNumber;
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
    this.stopPrice = safeBigNumber(params.stopPrice)
  }

  updatePrice(price: BigNumber) {
    super.updatePrice(price);
    if (price && this.otherPrice.eq(0)) {
      this.otherPrice = price.multipliedBy(1.02).decimalPlaces(this.precisionPrice > 0 ? this.precisionPrice : 0);
      this.stopPrice = price.multipliedBy(1.01).decimalPlaces(this.precisionPrice > 0 ? this.precisionPrice : 0)
    }
  }

  updateOtherPrice(otherPrice: BigNumber) {
    this.otherPrice = otherPrice.decimalPlaces(this.precisionPrice);
    if (otherPrice && this.price.eq(0)) {
      this.price = otherPrice.multipliedBy(0.98).decimalPlaces(this.precisionPrice > 0 ? this.precisionPrice : 0);
      this.stopPrice = otherPrice.multipliedBy(0.99).decimalPlaces(this.precisionPrice > 0 ? this.precisionPrice : 0)
    }
  }

  updateStopPrice(stopPrice: BigNumber) {
    this.stopPrice = stopPrice.decimalPlaces(this.precisionPrice);
    if (stopPrice && this.price.eq(0)) {
      this.otherPrice = stopPrice.multipliedBy(1.01).decimalPlaces(this.precisionPrice > 0 ? this.precisionPrice : 0);
      this.price = stopPrice.multipliedBy(0.99).decimalPlaces(this.precisionPrice > 0 ? this.precisionPrice : 0);
    }
  }
}
