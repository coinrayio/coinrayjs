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

  dispatchEvent = (type, data = {}) => {
    const callbacks = this.listeners[type];
    if (callbacks && callbacks.length > 0) {
      callbacks.map((callback) => callback({type, data}))
    }
  }
}
