export class ApiError extends Error {
  response: any;

  constructor(response: any) {
    super("Request failed");
    this.name = "ApiError";
    this.response = response
  }
}

export class KeyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "KeyError"
  }
}

export class MarketNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MarketNotFoundError"
  }
}


export class ExchangeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ExchangeError"
  }
}

export class CreateOrderError extends ExchangeError {
  constructor(message: string) {
    super(message);
    this.name = "CreateOrderError"
  }
}

export class InsufficientFundsError extends CreateOrderError {
  constructor(message: string = "Insufficient funds!") {
    super(message);
    this.name = "InsufficientFundsError"
  }
}

export class CancelOrderError extends ExchangeError {
  constructor(message: string) {
    super(message);
    this.name = "CancelOrderError"
  }
}

export class UpdateOrderError extends ExchangeError {
  constructor(message: string) {
    super(message);
    this.name = "UpdateOrderError"
  }
}

