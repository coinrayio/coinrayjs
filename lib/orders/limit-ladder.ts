import BigNumber from "bignumber.js";
import LimitOrder, {LimitOrderParams} from "./limit";
import _ from "lodash"
import Coinray from "../coinray";

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

export default class LimitLadderOrder extends LimitOrder {
  otherPrice: BigNumber;
  numOrders: number;
  priceScale: PriceScales;
  sizeScale: SizeScales;
  priceScales: Array<number>;
  sizeScales: Array<number>;

  constraints() {
    const limitConstraints = super.constraints();

    return {
      ...limitConstraints,
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

  constructor(coinray: Coinray, params: LimitLadderOrderParams) {
    super(coinray, params);
    this.otherPrice = params.otherPrice;
    this.numOrders = params.numOrders;
    this.priceScale = params.priceScale || PriceScales.CUSTOM;
    this.sizeScale = params.sizeScale || SizeScales.CUSTOM;
    this.lockedOn = params.lockedOn;

    this.priceScales = params.priceScales || PRICE_SCALES[this.priceScale](this.numOrders);
    this.sizeScales = params.sizeScales || SIZE_SCALES[this.sizeScale](this.numOrders);

    this.getOrders()
  }

  updateNumOrders(numOrders: number) {
    this.numOrders = numOrders
  }

  updatePrice(price: BigNumber) {
    super.updatePrice(price);
    if (price && this.otherPrice.eq(0)) {
      this.otherPrice = price.multipliedBy(0.95).decimalPlaces(this.precisionPrice > 0 ? this.precisionPrice : 0)
    }
    this.recalculate()
  }

  updateOtherPrice(otherPrice: BigNumber) {
    this.otherPrice = otherPrice;
    if (otherPrice && this.price.eq(0)) {
      this.price = otherPrice.multipliedBy(1.05).decimalPlaces(this.precisionPrice > 0 ? this.precisionPrice : 0)
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

  recalculate() {
    if (this.lockedOn === "baseAmount") {
      this.updateBaseAmount(this.baseAmount)
    } else {
      this.updateQuoteAmount(this.quoteAmount)
    }
  }

  updateQuoteAmount(quoteAmount: BigNumber) {
    this.updateLockedOn("quoteAmount");
    this.quoteAmount = quoteAmount;
    this.numOrders = Math.max(2, +this.numOrders);

    const orders = this.getOrders();
    if (orders.length > 0) {
      this.baseAmount = _.reduce(orders, (sum, order) => {
        return sum.plus(order.baseAmount)
      }, new BigNumber(0))
    }
  }

  updateBaseAmount(baseAmount: BigNumber) {
    this.updateLockedOn("baseAmount");
    this.baseAmount = baseAmount;
    this.numOrders = Math.max(2, +this.numOrders);

    const orders = this.getOrders();
    if (orders.length > 0) {
      this.quoteAmount = _.reduce(orders, (sum, order) => {
        return sum.plus(order.quoteAmount)
      }, new BigNumber(0))
    }
  }

  getOrders(): Array<LimitOrder> {
    const lockedOnAmount = this.lockedOn === "baseAmount" ? this.baseAmount : this.quoteAmount;

    if (!(this.priceScales && this.priceScales.length > 0 && this.sizeScales.length > 0 && lockedOnAmount.gt(0))) {
      return []
    }

    const priceScales = this.priceScales.slice(0, this.numOrders);
    const sizeScales = this.sizeScales.slice(0, this.numOrders);

    const diff = this.otherPrice.minus(this.price);

    return _.times(this.numOrders, (index) => {
      const amount = {
        [this.lockedOn]: lockedOnAmount.multipliedBy(sizeScales[index])
      };

      return new LimitOrder(this.coinray, {
        ...this,
        ...amount,
        price: this.price.plus(diff.multipliedBy(priceScales[index])).decimalPlaces(this.precisionPrice > 0 ? this.precisionPrice : 0),
      })
    })
  }

  async create(credentials: object): Promise<any> {
    const orders = this.getOrders();

    orders.map(async (order) => {
      return await order.create(credentials)
    })
  }
}
