// eslint-disable-next-line no-restricted-imports
import debounceLodash from 'lodash/debounce';
// eslint-disable-next-line no-restricted-imports
import throttleLodash from 'lodash/throttle';
import OrderedLinkedList from '@/lib/cache/OrderedLinkedList';
import { ThunkAPI } from '@/store/utils';
import { getHash, safeStringify } from './strings';

type CacheItem<F extends AnyFunction> = { result: ReturnType<F>; lastUsed: number };

/** Lodash debounce that warns in dev when no timeout is provided */
export const debounce = __DEV__
  ? <T extends AnyFunction>(
      ...args: Parameters<typeof debounceLodash<T>>
    ): ReturnType<typeof debounceLodash<T>> => {
      const [_, timeout] = args;
      if (!timeout) {
        // not using a real logger here because of circ deps
        console.warn('debounce is missing timeout:', timeout);
      }
      return debounceLodash(...args);
    }
  : debounceLodash;

/** Lodash throttle that warns in dev when no timeout is provided */
export const throttle = __DEV__
  ? <T extends AnyFunction>(
      ...args: Parameters<typeof throttleLodash<T>>
    ): ReturnType<typeof throttleLodash<T>> => {
      const [_, timeout] = args;
      if (!timeout) {
        // not using a real logger here because of circ deps
        console.warn('throttle is missing timeout:', timeout);
      }
      return throttleLodash(...args);
    }
  : throttleLodash;

export type ValueOrInitializer<T> = T | (() => T);

/**
 * Utility that either passes along a value, or if it gets a function, calls the function to generate a value.
 * If the function requires arguments, they will be passed along as well. Useful for things that behave similar
 * to useState, which accepts an initial value or a function to generate the initial value.
 */
export function valueOrInitializer<T>(
  valueOrInitFn: T,
  ...args: T extends AnyFunction ? Parameters<T> : never
): T extends AnyFunction ? ReturnType<T> : T {
  if (typeof valueOrInitFn === 'function') {
    return valueOrInitFn(...args);
  }
  return valueOrInitFn as any;
}

/**
 * Create a function that collects arguments into batches and processes them after a delay.
 *
 * @param callback - the function to execute on each batch of collected arguments
 * @param delay - the time in milliseconds to wait before processing a batch
 */
export function bufferUntil<TArgs extends any[]>(
  callback: (inputs: TArgs[]) => void,
  delay: number,
  { leading = false, trailing = true } = {}
): (...args: TArgs) => void {
  let batchArgs: TArgs[] = []; // hold batches of arguments.

  // process all currently batched arguments by calling the callback function with them,
  // then resets the batch array to be ready for the next set of arguments
  const processBatch = throttle(
    () => {
      // check if there are any arguments in the batch.
      if (batchArgs.length > 0) {
        callback(batchArgs); // execute the callback with the current batch
        batchArgs = []; // reset the batch array to start collecting new arguments
      }
    },
    delay,
    { leading, trailing }
  );

  return (...args: TArgs) => {
    batchArgs.push(args); // add the new arguments to the batch
    processBatch();
  };
}

export function bufferThunkUntil<TArg>(
  callback: (inputs: TArg[], thunkAPI: ThunkAPI) => void,
  delay: number,
  { leading = false, trailing = true } = {}
) {
  let batchArgs: TArg[] = []; // hold batches of arguments.
  let thunkAPI: ThunkAPI;
  // process all currently batched arguments by calling the callback function with them,
  // then resets the batch array to be ready for the next set of arguments
  const processBatch = throttle(
    () => {
      // check if there are any arguments in the batch.
      if (batchArgs.length > 0) {
        callback(batchArgs, thunkAPI); // execute the callback with the current batch
        batchArgs = []; // reset the batch array to start collecting new arguments
      }
    },
    delay,
    { leading, trailing }
  );

  return (arg: TArg, api: ThunkAPI) => {
    batchArgs.push(arg);
    thunkAPI = api;
    processBatch();
  };
}

export function createMemoOnArgsCache<F extends AnyFunction>() {
  return new OrderedLinkedList<string, CacheItem<F>>((a, b) => a.lastUsed - b.lastUsed);
}

export type MemoOnArgsCacheItem<F extends AnyFunction> = {
  result: ReturnType<F>;
  lastUsed: number;
};

type MemoOnArgsOptions<F extends AnyFunction> = Partial<{
  /** Convert argument array to an unique identifier, defaults to JSON.stringify + prettyFormat */
  hashFn: (args: any[]) => string;
  /** The maximum age of a memoized entry in milliseconds based on last access date */
  maxAge: number;
  /** The max size of the cache */
  maxSize: number;
  /** Called when a value is added to the cache */
  onCacheAdd: (cachedValue: ReturnType<F>) => void;
  /** Callback when deleting a cached entry to allow for cleanup, etc. */
  onCacheDelete: (cachedValue: ReturnType<F>) => void;
  /**
   * Called before a value is returned from the cache.
   * If onCacheHit returns false, the value is ejected from the cache and a new value is generated.
   */
  onCacheHit: (cachedValue: ReturnType<F>) => boolean | void;
  /** Provide your own cache for memoization */
  cache: OrderedLinkedList<string, CacheItem<F>>;
}>;

type MemoOnArgsFn<F extends AnyFunction> = F & {
  /** Clear the cache */
  clear(): void;
  /** Get the size of the cache */
  size(): number;
  /** Access the cache directly, in cases where you need to build on top of this */
  cache: OrderedLinkedList<string, CacheItem<F>>;
};

/**
 * Create memoized version of function that memos based on the arguments array
 * @returns memoized function with some helper methods and properties
 */
export function memoOnArgs<F extends AnyFunction>(
  fn: F,
  {
    hashFn = safeStringify,
    maxAge = 0,
    maxSize = 0,
    onCacheAdd,
    onCacheDelete,
    onCacheHit,
    cache = createMemoOnArgsCache(),
  }: MemoOnArgsOptions<F> = {}
): MemoOnArgsFn<F> {
  const deleteItem = (key: string, item = cache.get(key)) => {
    if (item) {
      cache.delete(key);
      onCacheDelete?.(item.result);
    }
  };

  const memoized = ((...args: Parameters<F>): ReturnType<F> => {
    const now = Date.now();
    let argsHash = hashFn(args);
    // if the generated hash is too large (~10Kb), calculate hash for the hash to save memory :)
    if (argsHash.length > 10_000) {
      argsHash = getHash(argsHash, 16);
    }
    const item = cache.get(argsHash);
    if (item) {
      // If onCacheHit returns false, or the item is expired, delete it
      // Otherwise, return it
      let shouldDelete = false;
      if (onCacheHit?.(item.result) === false) {
        shouldDelete = true;
      }
      const checkExpiration = !shouldDelete && item.lastUsed && maxAge;
      if (checkExpiration) {
        if (now - item.lastUsed >= maxAge) {
          shouldDelete = true;
        } else {
          item.lastUsed = now;
        }
      }

      if (shouldDelete) {
        deleteItem(argsHash, item);
      } else {
        return item.result;
      }
    }

    // trim our cache, as needed
    while (maxSize > 0 && cache.size >= maxSize) {
      const leastRecentUsedItemIteratorResult = cache[Symbol.iterator]().next();
      if (!leastRecentUsedItemIteratorResult.done) {
        const [hash, item] = leastRecentUsedItemIteratorResult.value;
        deleteItem(hash, item);
      }
    }

    // create and save the new result
    const result = fn(...args);
    cache.upsertManyRecords([
      {
        id: argsHash,
        value: { result, lastUsed: maxAge > 0 || maxSize > 0 ? now : 0 },
      },
    ]);
    onCacheAdd?.(result);

    return result;
  }) as MemoOnArgsFn<F>;

  memoized.clear = () => {
    if (onCacheDelete) {
      for (const [id, value] of cache) {
        deleteItem(id, value);
      }
    } else {
      cache.clear();
    }
  };
  memoized.size = () => cache.size;
  memoized.cache = cache;

  return memoized;
}

/**
 * Schedules a callback function to be executed at the end of the current event loop.
 *
 * @param {() => void} callback - The callback function to be executed.
 */
export function requestEndOfTickCallback(callback: () => void) {
  Promise.resolve().then(() => {
    callback();
  });
}

/**
 * Creates a debounced function that ensures the provided callback is only executed once
 * at the end of the current event loop tick, even if the returned function is called multiple times.
 *
 * @returns {function} - A function that takes a callback and schedules it to run at the end of the current tick.
 */
export function debounceEndOfTickCallback() {
  let currentCallback: () => void;
  let scheduled = false;

  return (newCallback: () => void) => {
    currentCallback = newCallback;
    if (!scheduled) {
      scheduled = true;
      requestEndOfTickCallback(() => {
        scheduled = false;
        currentCallback();
      });
    }
  };
}
