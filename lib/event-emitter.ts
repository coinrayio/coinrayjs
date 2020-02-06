export default class EventEmitter {
  public listeners: {};

  constructor() {
    this.listeners = {};
  }

  removeAllListeners() {
    this.listeners = {};
  }

  on = (type, callback) => {
    if (!(type in this.listeners)) {
      this.listeners[type] = []
    }
    this.listeners[type].push(callback);
    return callback
  };

  off = (type, callback) => {
    if (!(type in this.listeners)) {
      return;
    }
    if (callback) {
      this.listeners[type] = this.listeners[type].filter((c) => c !== callback)
    } else {
      this.listeners[type] = []
    }
  };

  hasListeners = (type) => {
    return this.listeners[type] && this.listeners[type].length > 0
  };

  dispatchEvent = (eventName, data = {}) => {
    const callbacks = this.listeners[eventName];
    if (callbacks && callbacks.length > 0) {
      callbacks.map((callback) => callback({eventName, data}))
    }
  }
}
