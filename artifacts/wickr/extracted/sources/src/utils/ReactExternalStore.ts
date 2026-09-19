import { toError } from './error';
import { valueOrInitializer } from './function';

/**
 * A generic external store implementation designed to work with React's useSyncExternalStore hook.
 *
 * This class provides a subscription-based store that manages a snapshot of state and notifies
 * React components when the state changes. It follows the external store pattern required by
 * React's concurrent features.
 *
 * @template T The type of the snapshot data
 * @see https://react.dev/reference/react/useSyncExternalStore
 */
export class ReactExternalStore<T extends AnyObject | any[] | string | number> {
  private callbacks = new Set<() => void>();

  protected notifyCallbacks() {
    let latestError: Error | undefined;

    // notify all callbacks and throw any errors at the end
    this.callbacks.forEach((callback) => {
      try {
        callback();
      } catch (error) {
        if (latestError) {
          const prevError = latestError;
          latestError = toError(error);
          latestError.cause = prevError;
        } else {
          latestError = toError(error);
        }
      }
    });

    if (latestError) {
      throw latestError;
    }
  }

  /**
   * Creates a new ReactExternalStore instance with an initial snapshot value.
   *
   * @param snapshot The initial snapshot value for the store
   */
  constructor(private snapshot: T) {}

  /**
   * Subscribes a callback function to be called when the store's snapshot changes.
   *
   * This method is designed to work with React's useSyncExternalStore hook.
   * The callback will be invoked whenever setSnapshot is called with a new value.
   *
   * @param callback A function to call when the snapshot changes
   * @returns A cleanup function that removes the subscription when called
   *
   * @example
   * ```typescript
   * const unsubscribe = store.subscribe(() => {
   *   console.log('Store updated!');
   * });
   *
   * // Later, to unsubscribe:
   * unsubscribe();
   * ```
   */
  subscribe = (callback: () => void): (() => void) => {
    this.callbacks.add(callback);

    return () => {
      this.callbacks.delete(callback);
    };
  };

  /**
   * Returns the current snapshot value of the store.
   *
   * This method is designed to work with React's useSyncExternalStore hook
   * and should return a stable reference when the data hasn't changed.
   *
   * @returns The current snapshot value
   * ```
   */
  getSnapshot = (): T => {
    return this.snapshot;
  };

  /**
   * Updates the store's snapshot value and notifies all subscribers if the value has changed.
   *
   * Accepts either a new value directly or a function that receives the current snapshot
   * and returns a new value. Only notifies subscribers if the new value is different
   * from the current snapshot (using strict equality comparison).
   *
   * @param setterOrValue Either a new snapshot value or a function that receives the current snapshot and returns a new value
   *
   * @example
   * ```typescript
   * // Setting a new value directly
   * store.setSnapshot({ count: 5 });
   *
   * // Using a function to update based on current value
   * store.setSnapshot(current => ({ count: current.count + 1 }));
   * ```
   */
  setSnapshot(setterOrValue: T | ((currentSnapshot: T) => T)) {
    const nextSnapshot = valueOrInitializer(setterOrValue, this.snapshot);

    if (nextSnapshot !== this.snapshot) {
      this.snapshot = nextSnapshot;
      this.notifyCallbacks();
    }
  }
}
