import { delay } from '@amzn/async-utils';
import { DependencyList, useEffect, useLayoutEffect, useRef } from 'react';

type AsyncEffectOptions = {
  /**
   * Promise that resolves when the previous effect function resolves.
   * It is undefined on first run.
   */
  previous: Promise<void> | undefined;
  /**
   * AbortSignal that is aborted on unmount/dependencies change
   */
  signal: AbortSignal;
};

type AsyncEffectCallback<T> = (options: AsyncEffectOptions) => T | Promise<T>;

type AsyncEffectDestructor<T> = (fxReturnValue: Promise<T>) => any;

const noop = () => {};

/** Promises that do not resolve cause memory leaks, so warn if this happens in dev */
const DEV_TIMEOUT_MS = 15_000;

/**
 * An async version of useEffect.
 *
 * The asyncEffectFn is passed an AbortSignal so it can handle dependency changes/unmount.
 *
 * An optional destructor function will be called on dependency changes/unmount.
 * It is passed a promise that resolves to the return value of the asyncEffectFn,
 * so it can handle any cleanup.
 *
 * @example
 * const [data, setData] = useState();
 * useAsyncEffect(
 *   // async effect callback
 *   async ({ signal, previous }) => {
 *     if (previous) await previous;
 *     try {
 *       // fetch will throw an error if the signal is aborted
 *       const res = await fetch(url, { signal });
 *       const data = await res.json();
 *       //                     ^^^ doesn't take a signal,
 *       // so we can handle it with signal.aborted,
 *       // which is like an "isMounted" check:
 *       if (signal.aborted) throw new Error("Aborted!");
 *
 *       setData(data);
 *
 *       return "Done";
 *     } catch (err) {
 *       // aborted
 *       return "Cancelled";
 *     }
 *   },
 *   // destructor function (optional)
 *   async (returnPromise) => {
 *     // logs "Done" or "Cancelled"
 *     console.log(await returnPromise);
 *   },
 *   // dependency list
 *   [url]
 * );
 */
export const useAsyncEffect = createAsyncEffectHook(useEffect, 'useAsyncEffect');

/**
 * An async version of useLayoutEffect.
 *
 * @see {@link useAsyncEffect} for details.
 */
export const useAsyncLayoutEffect = createAsyncEffectHook(useLayoutEffect, 'useAsyncLayoutEffect');

// Hook factory
function createAsyncEffectHook(useFxFn: typeof useEffect, effectName: string) {
  /** Run async effect with destructor that runs on dependency changes/unmount */
  function useAsyncFx<T>(
    asyncEffectCallback: AsyncEffectCallback<T>,
    destructor: AsyncEffectDestructor<T>,
    deps?: DependencyList
  ): void;

  /** Run async effect without destructor */
  function useAsyncFx<T>(asyncEffectCallback: AsyncEffectCallback<T>, deps?: any[]): void;

  function useAsyncFx<T>(
    asyncEffectCallback: AsyncEffectCallback<T>,
    destructorOrDeps?: AsyncEffectDestructor<T> | DependencyList,
    deps?: DependencyList
  ): void {
    // if 2nd arg is a function it is: (callback, destructor, deps?)
    // otherwise it is: (callback, deps?)
    let destructor: AsyncEffectDestructor<T> = noop;
    if (typeof destructorOrDeps === 'function') {
      destructor = destructorOrDeps;
    } else {
      deps = destructorOrDeps;
    }

    const previousRun = useRef<Promise<void>>();
    useFxFn(() => {
      const ctrl = new AbortController();
      const { signal } = ctrl;
      // wrap with Promise.resolve to handle sync functions
      const promise = Promise.resolve(
        asyncEffectCallback({
          signal,
          previous: previousRun.current,
        })
      );
      // resolve on the fulfillment of the promise, but do not expose return value/errors
      previousRun.current = promise.then(noop, noop);

      return () => {
        ctrl.abort();
        const done = destructor(promise);
        if (__DEV__ || __TEST__) {
          // throw an error if we don't settle the callback and/or destructor in time,
          // which is a source of memory leaks (the component cannot be GC'd until resolution)
          Promise.race([
            Promise.allSettled([promise, done]),
            delay(DEV_TIMEOUT_MS).then(() => {
              throw new Error(
                `${effectName} did not resolve ${DEV_TIMEOUT_MS}ms after use; this will cause a memory leak`
              );
            }),
          ]);
        }
      };
    }, deps);
  }

  return useAsyncFx;
}
