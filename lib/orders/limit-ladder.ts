import {OrderSide, OrderType} from "../types";
import BigNumber from "bignumber.js";
import LimitOrder, {LimitOrderParams} from "./limit";
import _ from "lodash"
import {safeBigNumber, safeInteger} from "../util";
import BaseOrder from "./base";

export enum PriceScales {
  LINEAR = "LINEAR",
  EXPONENTIAL = "EXPONENTIAL",
  FIBONACCI = "FIBONACCI",
  CUSTOM = "CUSTOM"
}

export enum SizeScales {
  EQUAL = "EQUAL",
  LINEAR = "LINEAR",
  LINEAR_REVERSE = "LINEAR_REVERSE",
  EXPONENTIAL = "EXPONENTIAL",
  EXPONENTIAL_REVERSE = "EXPONENTIAL_REVERSE",
  CUSTOM = "CUSTOM"
}

const PRICE_SCALES = {
  [PriceScales.LINEAR]: (numOrders: number): Array<number> => {
    return _.times(numOrders, (index) => (1 / (numOrders - 1)) * index)
  },
  [PriceScales.EXPONENTIAL]: (numOrders: number): Array<number> => {
    return PRICE_SCALES[PriceScales.LINEAR](numOrders).map((value) => (value) ** 2)
  },
  [PriceScales.FIBONACCI]: (numOrders: number): Array<number> => {
    const numbers = [0, 0.09, 0.146, 0.236, 0.382, 0.5, 0.618, 0.788, 0.886];

    return numbers.slice(0, numOrders - 1).concat([1]) // always make sure the last number is 1
  },
  [PriceScales.CUSTOM]: (numOrders: number): Array<number> => {
    return []
  }
};

const normalizeSizeScale = (scale: Array<number>) => {
  const sum = _.sum(scale);
  return scale.map((value) => value / sum)
};

const SIZE_SCALES = {
  [SizeScales.EQUAL]: (numOrders: number): Array<number> => {
    const scale = _.times(numOrders, () => 1);
    return normalizeSizeScale(scale)
  },
  [SizeScales.LINEAR]: (numOrders: number): Array<number> => {
    const scale = _.times(numOrders, (index) => (1 / (numOrders)) * (index + 1));
    return normalizeSizeScale(scale)
  },
  [SizeScales.EXPONENTIAL]: (numOrders: number): Array<number> => {
    const scale = SIZE_SCALES[SizeScales.LINEAR](numOrders).map((value) => value ** 2);
    return normalizeSizeScale(scale)
  },
  [SizeScales.LINEAR_REVERSE]: (numOrders: number): Array<number> => {
    return SIZE_SCALES[SizeScales.LINEAR](numOrders).reverse()
  },
  [SizeScales.EXPONENTIAL_REVERSE]: (numOrders: number): Array<number> => {
    return SIZE_SCALES[SizeScales.EXPONENTIAL](numOrders).reverse()
  },
  [SizeScales.CUSTOM]: (numOrders: number): Array<number> => {
    return []
  }
};

interface LimitLadderOrderParams extends LimitOrderParams {
  otherPrice: BigNumber
  numOrders: number
  priceScale?: PriceScales
  sizeScale?: SizeScales
  priceScales?: Array<number>
  sizeScales?: Array<number>
}

export default class LimitLadderOrder extends BaseOrder {
  baseAmount: BigNumber;
  quoteAmount: BigNumber;
  price: BigNumber;
  lockedOn: string;
  otherPrice: BigNumber;
  numOrders: number;
  priceScale: PriceScales;
  sizeScale: SizeScales;
  priceScales: Array<number>;
  sizeScales: Array<number>;

  orderType = OrderType.LIMIT_LADDER;

  constraints() {
    let maxBase = undefined;
    let maxQuote = undefined;
    if (this.side === OrderSide.BUY) {
      maxQuote = this.balances.quote
    } else {
      maxBase = this.balances.base;
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
      },
      otherPrice: {
        bigNumericality: {
          greaterThan: 0,
        }
      },
      numOrders: {
        numericality: {
          greaterThanOrEqualTo: 2,
        }
      }
    }
  }

  constructor(params: LimitLadderOrderParams) {
    super(params);
    this.otherPrice = safeBigNumber(params.otherPrice);
    this.numOrders = safeInteger(params.numOrders);
    this.priceScale = params.priceScale || PriceScales.CUSTOM;
    this.sizeScale = params.sizeScale || SizeScales.CUSTOM;
    this.price = safeBigNumber(params.price || "0");
    this.lockedOn = params.lockedOn;
    this.baseAmount = safeBigNumber(params.baseAmount || "0");
    this.quoteAmount = safeBigNumber(params.quoteAmount || "0");

    this.priceScales = params.priceScales || PRICE_SCALES[this.priceScale](this.numOrders);
    this.sizeScales = params.sizeScales || SIZE_SCALES[this.sizeScale](this.numOrders);

    if (this.quoteAmount.gt(0) && this.lockedOn === "quoteAmount") {
      this.updateQuoteAmount(this.quoteAmount)
    } else {
      this.updateBaseAmount(this.baseAmount)
    }
  }

  updateNumOrders(numOrders: number) {
    this.numOrders = numOrders
  }

  updatePrice(price: BigNumber, priceOffset = 0.05) {
    this.price = price.decimalPlaces(this.precisionPrice);
    if (price && this.otherPrice.eq(0)) {
      const offset = this.side === OrderSide.BUY ? 1 + priceOffset : 1 - priceOffset;
      this.otherPrice = price.multipliedBy(offset).decimalPlaces(this.precisionPrice > 0 ? this.precisionPrice : 0)
    }
    this.recalculate()
  }

  updateOtherPrice(otherPrice: BigNumber, priceOffset = 0.05) {
    this.otherPrice = otherPrice.decimalPlaces(this.precisionPrice);
    if (otherPrice && this.price.eq(0)) {
      const offset = this.side === OrderSide.BUY ? 1 - priceOffset : 1 + priceOffset;
      this.price = otherPrice.multipliedBy(offset).decimalPlaces(this.precisionPrice > 0 ? this.precisionPrice : 0)
    }
    this.recalculate()
  }

  updatePriceScales(priceScales: Array<number>) {
    this.priceScales = priceScales;
    this.priceScale = PriceScales.CUSTOM;
    this.recalculate()
  }

  updatePriceScale(priceScale: PriceScales) {
    this.priceScales = PRICE_SCALES[priceScale](this.numOrders);
    this.priceScale = priceScale;
    this.recalculate()
  }

  updateSizeScales(sizeScales: Array<number>) {
    this.sizeScales = sizeScales;
    this.sizeScale = SizeScales.CUSTOM;
    this.recalculate()
  }

  updateSizeScale(sizeScale: SizeScales) {
    this.sizeScales = SIZE_SCALES[sizeScale](this.numOrders);
    this.sizeScale = sizeScale;
    this.recalculate()
  }

  updateLockedOn(lockedOn: string) {
    this.lockedOn = lockedOn
  }

  recalculate() {
    if (this.lockedOn === "baseAmount") {
      this.updateBaseAmount(this.baseAmount)
    } else {
      this.updateQuoteAmount(this.quoteAmount)
    }
    this.validate()
  }

  updateQuoteAmount(quoteAmount: BigNumber) {
    this.quoteAmount = quoteAmount;
    this.numOrders = Math.max(2, +this.numOrders);

    const orders = this.getOrders("quoteAmount");
    if (orders.length > 0) {
      this.baseAmount = _.reduce(orders, (sum, order) => {
        return sum.plus(order.baseAmount)
      }, new BigNumber(0))
    } else {
      this.baseAmount = new BigNumber(0)
    }
  }

  updateBaseAmount(baseAmount: BigNumber, setLockedOn = false) {
    this.baseAmount = baseAmount;
    this.numOrders = Math.max(2, +this.numOrders);

    const orders = this.getOrders("baseAmount");
    if (orders.length > 0) {
      this.quoteAmount = _.reduce(orders, (sum, order) => {
        return sum.plus(order.quoteAmount)
      }, new BigNumber(0))
    } else {
      this.quoteAmount = new BigNumber(0)
    }
  }

  getOrders(lockedOn = this.lockedOn): Array<LimitOrder> {
    const lockedOnAmount = lockedOn === "baseAmount" ? this.baseAmount : this.quoteAmount;
    const precisionAmount = lockedOn === "baseAmount" ? this.precisionBase : this.precisionQuote;

    if (!(this.priceScales && this.priceScales.length > 0 && this.sizeScales.length > 0 && lockedOnAmount.gt(0))) {
      return []
    }

    const priceScales = this.priceScales.slice(0, this.numOrders);
    const sizeScales = this.sizeScales.slice(0, this.numOrders);

    const diff = this.otherPrice.minus(this.price);

    return _.times(this.numOrders, (index) => {
      const amount = {
        [lockedOn]: lockedOnAmount.multipliedBy(sizeScales[index]).decimalPlaces(precisionAmount > 0 ? precisionAmount : 0, BigNumber.ROUND_DOWN)
      };

      return new LimitOrder({
        ...this,
        ...amount,
        lockedOn,
        price: this.price.plus(diff.multipliedBy(priceScales[index])).decimalPlaces(this.precisionPrice > 0 ? this.precisionPrice : 0),
      })
    })
  }
}

