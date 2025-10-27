class TickerSubscriptions {
  public subscriptions: Map<string, Set<string>>;
  public pendingAdditions: Map<string, Set<string>>;
  public pendingRemovals: Map<string, Set<string>>;

  constructor() {
    this.subscriptions = new Map<string, Set<string>>();
    this.pendingAdditions = new Map<string, Set<string>>();
    this.pendingRemovals = new Map<string, Set<string>>();
  }

  has(ticker: string): boolean {
    const listeners = this.subscriptions.get(ticker);
    return listeners !== undefined && listeners.size > 0;
  }

  subscribe(listenerId: string, tickers: string[], reset: boolean = false) {
    if (reset) {
      this.unsubscribeAll(listenerId);
    }

    for (let ticker of tickers) {
      if (!this.pendingAdditions.has(ticker)) {
        this.pendingAdditions.set(ticker, new Set<string>());
      }
      this.pendingAdditions.get(ticker)!.add(listenerId);

      if (this.pendingRemovals.has(ticker)) {
        this.pendingRemovals.get(ticker)!.delete(listenerId);
        if (this.pendingRemovals.get(ticker)!.size === 0) {
          this.pendingRemovals.delete(ticker);
        }
      }
    }
  }

  unsubscribe(listenerId: string,  tickers: string[]) {
    for (let ticker of tickers) {
      if (this.pendingAdditions.has(ticker)) {
        this.pendingAdditions.get(ticker)!.delete(listenerId);
        if (this.pendingAdditions.get(ticker)!.size === 0) {
          this.pendingAdditions.delete(ticker);
        }
      }

      if (!this.pendingRemovals.has(ticker)) {
        this.pendingRemovals.set(ticker, new Set<string>());
      }
      this.pendingRemovals.get(ticker)!.add(listenerId);
    }
  }

  unsubscribeAll(listenerId: string) {
    for (let [ticker, listeners] of this.subscriptions) {
      if (listeners.has(listenerId)) {
        if (!this.pendingRemovals.has(ticker)) {
          this.pendingRemovals.set(ticker, new Set<string>());
        }
        this.pendingRemovals.get(ticker)!.add(listenerId);
      }
    }
    this.pendingAdditions.clear();
  }

  processPendingChanges() {
    for (let [ticker, listenersToAdd] of this.pendingAdditions) {
      if (!this.subscriptions.has(ticker)) {
        this.subscriptions.set(ticker, new Set<string>());
      }
      const currentListeners = this.subscriptions.get(ticker)!;
      for (let listenerId of listenersToAdd) {
        currentListeners.add(listenerId);
      }
    }

    for (let [ticker, listenersToRemove] of this.pendingRemovals) {
      if (!this.subscriptions.has(ticker)) {
        continue;
      }
      const currentListeners = this.subscriptions.get(ticker)!;
      for (let listenerId of listenersToRemove) {
        currentListeners.delete(listenerId);
      }
      if (currentListeners.size === 0) {
        this.subscriptions.delete(ticker);
      }
    }

    this.pendingAdditions.clear();
    this.pendingRemovals.clear();
  }
}

export default TickerSubscriptions;
