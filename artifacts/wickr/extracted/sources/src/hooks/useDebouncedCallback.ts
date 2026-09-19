// eslint-disable-next-line lodash/import-scope
import { DebouncedFunc, DebounceSettings, ThrottleSettings } from 'lodash';
import { useCallback, useRef } from 'react';
import { debounce } from '@/utils/function';
import { withoutNilProperties } from '@/utils/lang';
import useLatestCallback from './useLatestCallback';

type AnyFunction = (...args: any[]) => any;

/**
 * Lodash debounce needs a stable function, but components generally need the latest
 * version of a callback that has access to the current state and props.
 * @returns a debounced function pointer that only changes when debounce settings change,
 * and always runs the latest version of the callback.
 */
export default function useDebouncedCallback<T extends AnyFunction>(
  callback: T,
  wait?: number,
  settings: DebounceSettings = {}
): DebouncedFunc<T> {
  const cb = useLatestCallback(callback);

  // debounce doesn't like things like leading: undefined, so clean undefined values
  settings = withoutNilProperties(settings);
  // re-create the debounced function when timeout/settings change
  const debouncedFn = useCallback(debounce<AnyFunction>(cb, wait, settings), [
    cb,
    wait,
    settings.leading,
    settings.trailing,
    settings.maxWait,
  ]);
  const debouncedFnRef = useRef(debouncedFn);
  if (debouncedFnRef.current !== debouncedFn) {
    debouncedFnRef.current.cancel();
    debouncedFnRef.current = debouncedFn;
  }

  // create a stable ref that points to latest debouncedFnRef
  const stableFn = useRef<DebouncedFunc<T>>();
  if (!stableFn.current) {
    const fn: DebouncedFunc<T> = (...args) => debouncedFnRef.current(...args);
    fn.cancel = () => debouncedFnRef.current.cancel();
    fn.flush = () => debouncedFnRef.current.flush();
    stableFn.current = fn;
  }

  // use the stable ref
  return stableFn.current;
}

/**
 * Lodash throttle needs a stable function, but components generally need the latest
 * version of a callback that has access to the current state and props.
 * @returns a throttled function pointer that only changes when debounce settings change,
 * and always runs the latest version of the callback.
 */
export function useThrottledCallback<T extends AnyFunction>(
  callback: T,
  wait?: number,
  settings: ThrottleSettings = {}
): DebouncedFunc<T> {
  return useDebouncedCallback(callback, wait, {
    // default throttled settings
    // https://lodash.com/docs/4.17.15#throttle
    leading: true,
    trailing: true,
    ...withoutNilProperties(settings),
    // maxWait turns debounce into throttle
    maxWait: wait,
  });
}
