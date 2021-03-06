import {OrderSide, OrderType} from "../types";
import BigNumber from "bignumber.js";
import LimitOrder, {LimitOrderParams} from "./limit";
import {safeBigNumber} from "../util";

interface OcoOrderParams extends LimitOrderParams {
  linkedOrderId: string,
  otherPrice: BigNumber,
  stopPrice: BigNumber,
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
    super(params, false);
    this.otherPrice = safeBigNumber(params.otherPrice);
    this.stopPrice = safeBigNumber(params.stopPrice);

    if (this.quoteAmount.gt(0) && this.lockedOn === "quoteAmount") {
      this.updateQuoteAmount(this.quoteAmount)
    } else {
      this.updateBaseAmount(this.baseAmount)
    }
  }

  updateQuoteAmount(quoteAmount: BigNumber) {
    this.quoteAmount = quoteAmount;
    let basePrice = this.side === OrderSide.BUY ? this.otherPrice : this.price;
    this.baseAmount = quoteAmount.dividedBy(basePrice).decimalPlaces(this.precisionBase > 0 ? this.precisionBase : 0, BigNumber.ROUND_DOWN);
    this.validate()
  }

  updateBaseAmount(baseAmount: BigNumber) {
    this.baseAmount = baseAmount;
    let basePrice = this.side === OrderSide.BUY ? this.otherPrice : this.price;
    this.quoteAmount = basePrice.multipliedBy(this.baseAmount).decimalPlaces(this.precisionQuote > 0 ? this.precisionQuote : 0, BigNumber.ROUND_DOWN);
    this.validate()
  }

  updatePrice(price: BigNumber, priceOffset = 0.05) {
    super.updatePrice(price);
    if (price && this.otherPrice.eq(0)) {
      const offset = this.side === OrderSide.BUY ? 1 + (priceOffset * 2) : 1 - (priceOffset * 2);
      const stopOffset = this.side === OrderSide.BUY ? 1 + priceOffset : 1 - priceOffset;

      this.otherPrice = price.multipliedBy(offset).decimalPlaces(this.precisionPrice > 0 ? this.precisionPrice : 0);
      this.stopPrice = price.multipliedBy(stopOffset).decimalPlaces(this.precisionPrice > 0 ? this.precisionPrice : 0)
    }
  }

  updateOtherPrice(otherPrice: BigNumber, priceOffset = 0.05) {
    this.otherPrice = otherPrice.decimalPlaces(this.precisionPrice);
    if (otherPrice && this.price.eq(0)) {
      const offset = this.side === OrderSide.BUY ? 1 - (priceOffset * 2) : 1 + (priceOffset * 2);
      const stopOffset = this.side === OrderSide.BUY ? 1 - priceOffset : 1 + priceOffset;

      this.price = otherPrice.multipliedBy(offset).decimalPlaces(this.precisionPrice > 0 ? this.precisionPrice : 0);
      this.stopPrice = otherPrice.multipliedBy(stopOffset).decimalPlaces(this.precisionPrice > 0 ? this.precisionPrice : 0)
    }
  }

  updateStopPrice(stopPrice: BigNumber, priceOffset = 0.05) {
    this.stopPrice = stopPrice.decimalPlaces(this.precisionPrice);
    if (stopPrice && this.price.eq(0)) {
      const offset = this.side === OrderSide.BUY ? 1 - priceOffset : 1 + priceOffset;
      const otherOffset = this.side === OrderSide.BUY ? 1 + priceOffset : 1 - priceOffset;

      this.price = stopPrice.multipliedBy(offset).decimalPlaces(this.precisionPrice > 0 ? this.precisionPrice : 0);
      this.otherPrice = stopPrice.multipliedBy(otherOffset).decimalPlaces(this.precisionPrice > 0 ? this.precisionPrice : 0);
    }
  }
}
