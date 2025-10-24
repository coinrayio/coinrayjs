import BaseOrder from "./base";
import {BalanceLimit, BaseOrderParams, OrderType} from "../types";
import BigNumber from "bignumber.js";
import {correctNumberPrecision, safeBigNumber} from "../util";
import Coinray from "../coinray";

export interface LimitOrderParams extends BaseOrderParams {
  baseAmount: BigNumber
  quoteAmount: BigNumber
  price: BigNumber
  lockedOn: string
}

export default class LimitOrder extends BaseOrder {
  baseAmount: BigNumber;
  quoteAmount: BigNumber;
  price: BigNumber;
  lockedOn: string;
  declare balanceLimit: BalanceLimit;

  orderType = OrderType.LIMIT;

  constraints() {
    let maxBase = undefined;
    let maxQuote = undefined;
    if (this.balanceLimit === BalanceLimit.QUOTE) {
      maxQuote = this.balances.quote || 0
    } else if (this.balanceLimit === BalanceLimit.BASE) {
      maxBase = this.balances.base || 0
    }

    return {
      baseAmount: {
        bigNumericality: {
          greaterThanOrEqualTo: this.minBase.toNumber(),
          notGreaterThanOrEqualTo: `^${Coinray.I18n.t("validation.notGreaterThanOrEqualTo", {min: correctNumberPrecision(this.precisionBase, this.minBase)})}`,
          lessThanOrEqualTo: maxBase ? maxBase.toNumber() : undefined,
          notLessThanOrEqualTo: `^${Coinray.I18n.t("validation.insufficientFunds")}`,
        }
      },
      quoteAmount: {
        bigNumericality: {
          greaterThanOrEqualTo: this.minQuote.toNumber(),
          notGreaterThanOrEqualTo: `^${Coinray.I18n.t("validation.notGreaterThanOrEqualTo", {min: correctNumberPrecision(this.precisionQuote, this.minQuote)})}`,
          lessThanOrEqualTo: maxQuote ? maxQuote.toNumber() : undefined,
          notLessThanOrEqualTo: `^${Coinray.I18n.t("validation.insufficientFunds")}`,
        }
      },
      price: {
        bigNumericality: {
          greaterThan: 0,
        }
      }
    }
  }

  constructor(params: LimitOrderParams, updateAmounts = true) {
    super(params);
    this.price = safeBigNumber(params.price || "0");
    this.lockedOn = params.lockedOn;
    this.baseAmount = safeBigNumber(params.baseAmount);
    this.quoteAmount = safeBigNumber(params.quoteAmount);

    if (updateAmounts) {
      if (this.quoteAmount.gt(0) && this.lockedOn === "quoteAmount") {
        this.updateQuoteAmount(this.quoteAmount)
      } else {
        this.updateBaseAmount(this.baseAmount)
      }
    }
  }

  updateBaseAmount(baseAmount: BigNumber) {
    this.baseAmount = baseAmount;
    this.quoteAmount = this.price.multipliedBy(this.baseAmount).decimalPlaces(this.precisionQuote > 0 ? this.precisionQuote : 0, BigNumber.ROUND_DOWN);
    this.validate()
  }

  updateQuoteAmount(quoteAmount: BigNumber) {
    this.quoteAmount = quoteAmount;
    this.baseAmount = quoteAmount.dividedBy(this.price).decimalPlaces(this.precisionBase > 0 ? this.precisionBase : 0, BigNumber.ROUND_DOWN);
    this.validate()
  }

  updateLockedOn(lockedOn: string) {
    this.lockedOn = lockedOn;
    this.validate()
  }

  quoteFee() {
    return this.quoteAmount.multipliedBy(this.takerFee)
  }

  updatePrice(price: BigNumber) {
    this.price = price.decimalPlaces(this.precisionPrice);

    if (this.lockedOn === "baseAmount") {
      this.updateBaseAmount(this.baseAmount)
    } else {
      this.updateQuoteAmount(this.quoteAmount)
    }
  }

  getOrders(): Array<BaseOrder> {
    return [this]
  }
}
