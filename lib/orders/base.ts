import validate from "./validate"
import {BaseOrderParams, MarketBalance, OrderSide} from "../types";
import BigNumber from "bignumber.js";

export default abstract class BaseOrder {
  exchangeCode: string;
  quoteCurrency: string;
  baseCurrency: string;
  coinraySymbol: string;
  precisionAmount: number;
  precisionPrice: number;
  minBaseAmount: BigNumber;
  makerFee: BigNumber;
  takerFee: BigNumber;
  balances: MarketBalance;
  side: OrderSide;
  errors: any;

  constructor(params: BaseOrderParams) {
    this.exchangeCode = params.exchangeCode;
    this.baseCurrency = params.baseCurrency;
    this.quoteCurrency = params.quoteCurrency;
    this.coinraySymbol = [this.exchangeCode, this.quoteCurrency, this.baseCurrency].join("_").toUpperCase();
    this.precisionAmount = params.precisionAmount;
    this.precisionPrice = params.precisionPrice;
    this.minBaseAmount = new BigNumber(params.minBaseAmount);
    this.makerFee = new BigNumber(params.makerFee);
    this.takerFee = new BigNumber(params.takerFee);
    this.balances = params.balances;
    this.side = params.side;
    this.errors = {}
  }

  abstract constraints(): object

  abstract getOrders(): Array<BaseOrder>

  abstract async create(credentials: object): Promise<void>;

  validate(): boolean {
    const errors = validate(this, this.constraints());

    if (errors) {
      this.errors = errors
    }
    return !errors
  }
}
