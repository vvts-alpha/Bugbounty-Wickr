import { useRef } from 'react';

/**
 * @returns a stable function pointer which will always run the latest function passed to it.
 *
 * This is useful in places where we need to make sure the function pointer never changes,
 * such as with subscriptions in useEffects, custom ref functions (they must be stable), etc.
 */
export default function useLatestCallback<F extends AnyFunction>(fn: F): F {
  // This ref will point to the latest function and is updated on each render
  const latestFnRef = useRef<F>(fn);
  latestFnRef.current = fn;

  // This ref will only be created once, and holds a function that proxies to the latest function
  const stableFnForwardToLatestFnRef = useRef<F>(((...args: Parameters<F>) => {
    return latestFnRef.current(...args);
  }) as F);
  return stableFnForwardToLatestFnRef.current;
}
