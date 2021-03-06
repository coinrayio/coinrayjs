import validate from "./validate"
import {BalanceLimit, BaseOrderParams, MarketBalance, OrderSide, TimeInForce} from "../types";
import BigNumber from "bignumber.js";
import {safeBigNumber, safeInteger} from "../util";
import UUID from "uuid/v4"

export default abstract class BaseOrder {
  id = UUID();
  coinraySymbol: string;
  precisionBase: number;
  precisionQuote: number;
  precisionPrice: number;
  minBase: BigNumber;
  minQuote: BigNumber;
  makerFee: BigNumber;
  takerFee: BigNumber;
  balances: MarketBalance;
  balanceLimit: BalanceLimit;
  side: OrderSide;
  errors: any;
  isValid: boolean;
  orderExternalId?: string;
  reduceOnly?: boolean;
  postOnly?: boolean;
  timeInForce?: TimeInForce;

  constructor(params: BaseOrderParams) {
    this.coinraySymbol = params.coinraySymbol;
    this.precisionBase = safeInteger(params.precisionBase);
    this.precisionQuote = safeInteger(params.precisionQuote);
    this.precisionPrice = safeInteger(params.precisionPrice);
    this.minBase = safeBigNumber(params.minBase);
    this.minQuote = safeBigNumber(params.minQuote);
    this.makerFee = safeBigNumber(params.makerFee);
    this.takerFee = safeBigNumber(params.takerFee);
    this.balances = params.balances;
    this.balanceLimit = params.balanceLimit || BalanceLimit.NONE;
    this.side = params.side;
    this.orderExternalId = params.externalId;
    this.errors = {};
    this.isValid = true
    this.reduceOnly = params.reduceOnly
    this.postOnly =  params.postOnly
    this.timeInForce = params.timeInForce
  }

  abstract constraints(): object

  abstract getOrders(): Array<BaseOrder>

  startEdit(orderExternalId: string) {
    this.orderExternalId = orderExternalId
  }

  updateLockedOn(lockedOn: string) {
  }

  resetError() {
    this.errors = {};
    this.isValid = true
  }

  validate(): boolean {
    const errors = validate(this, this.constraints());

    if (errors) {
      this.errors = errors;
      this.isValid = false
    } else {
      this.resetError()
    }
    return !errors
  }
}
