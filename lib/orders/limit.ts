import BaseOrder from "./base";
import {BaseOrderParams, OrderType} from "../types";
import BigNumber from "bignumber.js";
import Coinray from "../coinray";
import {CancelOrderError} from "../errors";

export interface LimitOrderParams extends BaseOrderParams {
  baseAmount: BigNumber
  quoteAmount: BigNumber
  price: BigNumber
  lockedOn: string
}

export default class LimitOrder extends BaseOrder {
  coinray: Coinray;
  baseAmount: BigNumber;
  quoteAmount: BigNumber;
  price: BigNumber;
  lockedOn: string;
  orderExternalId?: string;

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

  constructor(coinray: Coinray, params: LimitOrderParams) {
    super(params);
    this.coinray = coinray;
    this.price = params.price || new BigNumber("0");
    this.lockedOn = params.lockedOn;
    this.baseAmount = params.baseAmount;
    this.quoteAmount = params.quoteAmount;

    if (params.baseAmount && this.lockedOn === "baseAmount") {
      this.updateBaseAmount(params.baseAmount)
    } else {
      this.updateQuoteAmount(params.quoteAmount)
    }
  }

  startEdit(orderExternalId: string) {
    this.orderExternalId = orderExternalId
  }

  updateBaseAmount(baseAmount: BigNumber) {
    this.baseAmount = baseAmount;
    this.quoteAmount = this.price.multipliedBy(this.baseAmount).decimalPlaces(this.precisionPrice > 0 ? this.precisionPrice : 0);

    this.updateLockedOn("baseAmount")
  }

  updateQuoteAmount(quoteAmount: BigNumber) {
    this.quoteAmount = quoteAmount;

    this.baseAmount = quoteAmount.dividedBy(this.price).decimalPlaces(this.precisionAmount > 0 ? this.precisionAmount : 0);
    this.updateLockedOn("quoteAmount")
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

  async create(encryptedApiKey: object): Promise<any> {
    return await this.coinray.createOrder({
      encryptedApiKey,
      coinraySymbol: this.coinraySymbol,
      type: this.orderType,
      side: this.side,
      quantity: this.baseAmount,
      price: this.price
    })
  }

  async update(encryptedApiKey: object, orderId: string): Promise<any> {
    return await this.coinray.updateOrder({
      encryptedApiKey,
      coinraySymbol: this.coinraySymbol,
      orderId,
      type: this.orderType,
      side: this.side,
      quantity: this.baseAmount,
      price: this.price
    })
  }

  async cancel(encryptedApiKey: object, orderId: string): Promise<any> {
    if (orderId) {
      return await this.coinray.cancelOrder({
        encryptedApiKey,
        coinraySymbol: this.coinraySymbol,
        orderId
      })
    } else {
      throw new CancelOrderError("Order ID missing")
    }
  }
}
