import validate from "./validate"
import {BaseOrderParams, MarketBalance, OrderSide} from "../types";
import BigNumber from "bignumber.js";
import {safeBigNumber, safeInteger} from "../util";
import UUID from "uuid/v4"

export default abstract class BaseOrder {
  id = UUID();
  coinraySymbol: string;
  precisionAmount: number;
  precisionPrice: number;
  minBase: BigNumber;
  minQuote: BigNumber;
  makerFee: BigNumber;
  takerFee: BigNumber;
  balances: MarketBalance;
  side: OrderSide;
  errors: any;
  isValid: boolean;
  orderExternalId?: string;

  constructor(params: BaseOrderParams) {
    this.coinraySymbol = params.coinraySymbol;
    this.precisionAmount = safeInteger(params.precisionAmount);
    this.precisionPrice = safeInteger(params.precisionPrice);
    this.minBase = safeBigNumber(params.minBase);
    this.minQuote = safeBigNumber(params.minQuote);
    this.makerFee = safeBigNumber(params.makerFee);
    this.takerFee = safeBigNumber(params.takerFee);
    this.balances = params.balances;
    this.side = params.side;
    this.orderExternalId = params.externalId;
    this.errors = {};
    this.isValid = true
  }

  abstract constraints(): object

  abstract getOrders(): Array<BaseOrder>

  startEdit(orderExternalId: string) {
    this.orderExternalId = orderExternalId
  }

  validate(): boolean {
    const errors = validate(this, this.constraints());

    if (errors) {
      this.errors = errors;
      this.isValid = false
    } else {
      this.errors = {};
      this.isValid = true
    }
    return !errors
  }
}