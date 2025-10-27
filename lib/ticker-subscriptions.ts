class TickerSubscriptions {
  public subscriptions: Set<string>;
  public pendingAdditions: Set<string>;
  public pendingRemovals: Set<string>;
  constructor() {
    this.subscriptions = new Set<string>();
    this.pendingAdditions = new Set<string>();
    this.pendingRemovals = new Set<string>();
  }

  has(ticker: string): boolean {
    return this.subscriptions.has(ticker);
  }

  subscribe(tickers: string[], reset : boolean = false) {
    if (reset) {
      this.unsubscribeAll();
    }

    for (let ticker of tickers) {
      this.pendingAdditions.add(ticker);
      this.pendingRemovals.delete(ticker);
    }
  }

  unsubscribe(tickers: string[]) {
    for (let ticker of tickers) {
      this.pendingRemovals.add(ticker);
      this.pendingAdditions.delete(ticker);
    }
  }

  unsubscribeAll() {
    for (let ticker of this.subscriptions) {
      this.pendingRemovals.add(ticker);
    }
    this.pendingAdditions.clear();
  }

  processPendingChanges() {
    for (let ticker of this.pendingAdditions) {
      this.subscriptions.add(ticker);
    }
    for (let ticker of this.pendingRemovals) {
      this.subscriptions.delete(ticker);
    }
    this.pendingAdditions.clear();
    this.pendingRemovals.clear();
  }
}

export default TickerSubscriptions;
