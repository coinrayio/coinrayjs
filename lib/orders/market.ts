import BaseOrder from "./base";
import {BalanceLimit, BaseOrderParams, OrderType} from "../types";
import BigNumber from "bignumber.js";
import Coinray from "../coinray";
import {correctNumberPrecision, safeBigNumber} from "../util";


interface MarketOrderParams extends BaseOrderParams {
  quoteAmount?: BigNumber,
  baseAmount?: BigNumber,
}

export default class MarketOrder extends BaseOrder {
  baseAmount?: BigNumber;
  quoteAmount?: BigNumber;
  price: BigNumber;
  orderType = OrderType.MARKET;

  constraints = () => {
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
          greaterThanOrEqualTo: maxBase ? this.minBase.toNumber() : undefined,
          notGreaterThanOrEqualTo: `^${Coinray.I18n.t("validation.notGreaterThanOrEqualTo", {min: correctNumberPrecision(this.precisionBase, this.minBase)})}`,
          lessThanOrEqualTo: maxBase ? maxBase.toNumber() : undefined,
          notLessThanOrEqualTo: `^${Coinray.I18n.t("validation.insufficientFunds")}`,
        }
      },
      quoteAmount: {
        bigNumericality: {
          greaterThanOrEqualTo: maxQuote ? this.minQuote.toNumber() : undefined,
          notGreaterThanOrEqualTo: `^${Coinray.I18n.t("validation.notGreaterThanOrEqualTo", {min: correctNumberPrecision(this.precisionQuote, this.minQuote)})}`,
          lessThanOrEqualTo: maxQuote ? maxQuote.toNumber() : undefined,
          notLessThanOrEqualTo: `^${Coinray.I18n.t("validation.insufficientFunds")}`,
        }
      },
    }
  };

  constructor(params: MarketOrderParams) {
    super(params);
    this.updateQuoteAmount(params.quoteAmount);
    this.updateBaseAmount(params.baseAmount);
  }

  updateBaseAmount(baseAmount: BigNumber) {
    this.baseAmount = baseAmount;
    if (baseAmount) this.quoteAmount = this.price.multipliedBy(this.baseAmount).decimalPlaces(this.precisionQuote > 0 ? this.precisionQuote : 0, BigNumber.ROUND_DOWN);
    this.validate()
  }

  updateQuoteAmount(quoteAmount: BigNumber) {
    this.quoteAmount = quoteAmount;
    if (quoteAmount) this.baseAmount = quoteAmount.dividedBy(this.price).decimalPlaces(this.precisionBase > 0 ? this.precisionBase : 0, BigNumber.ROUND_DOWN);
    this.validate()
  }

  updatePrice(price: BigNumber) {
    this.price = price.decimalPlaces(this.precisionPrice);
  }

  getOrders(): Array<BaseOrder> {
    return [this]
  }
}
