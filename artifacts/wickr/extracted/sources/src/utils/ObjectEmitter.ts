type Callback<V> = (value: V) => any;
type Unsubscribe = () => void;

/**
 * Emitter utility that accepts any type for the key (versus traditional string-based emitters)
 * Useful for subscriptions based on DOM elements, etc.
 */
export class ObjectEmitter<Obj, Value> {
  private callbackMap = new Map<Obj, Set<Callback<Value>>>();

  /** Subscribe to events on the object indefinitely */
  on(obj: Obj, callback: Callback<Value>): Unsubscribe {
    let callbacks = this.callbackMap.get(obj);
    if (!callbacks) {
      callbacks = new Set();
      this.callbackMap.set(obj, callbacks);
    }
    callbacks.add(callback);
    return () => this.off(obj, callback);
  }

  /** Subscribe to the next event on the object */
  once(obj: Obj, callback: Callback<Value>): Unsubscribe {
    const cb: Callback<Value> = (value) => {
      callback(value);
      off();
    };
    const off = this.on(obj, cb);
    return off;
  }

  /** Unsubscribe a callback */
  off(obj: Obj, callback: Callback<Value>): void {
    const callbacks = this.callbackMap.get(obj);
    if (callbacks) {
      callbacks.delete(callback);
      if (!callbacks.size) this.callbackMap.delete(obj);
    }
  }

  /** Emit a value, returning true if any callbacks are active */
  emit(obj: Obj, value: Value): boolean {
    const callbacks = this.callbackMap.get(obj);
    if (callbacks) {
      callbacks.forEach((cb) => cb(value));
      return true;
    }
    return false;
  }

  /** Clear all callbacks */
  clearAll() {
    this.callbackMap.clear();
  }

  listenerCount(obj: Obj): number {
    return this.callbackMap.get(obj)?.size ?? 0;
  }

  allListenersCount(): number {
    return [...this.callbackMap.values()].reduce((acc, curr) => acc + curr.size, 0);
  }
}
