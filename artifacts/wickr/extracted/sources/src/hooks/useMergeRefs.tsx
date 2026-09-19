import { ForwardedRef, useCallback } from 'react';
import { assignRef } from '@/utils/react';

/**
 * A custom hook to merge multiple refs into a single ref callback.
 * This is to avoid duplicate calls to the set ref function, it is useful in scenarios
 * where a single DOM element needs to be referenced by multiple owners.
 * @param refs  An array of refs that we want to merge
 * @param deps Optional array of dependencies for updating the refs. By default the refs
 * array will be used, but this allows finer-graind control if necessary.
 *
 * @example
 *   // This code will get fired 2x on every render because the function changes
 *   // 1. Call setRef(null) on previous fn
 *   // 2. Call setRef(el) on new fn
 *   <div ref={(ref) => { ref1.current = ref; ref2.current = ref; }} >
 *
 *   // We can do this instead
 *   const mergedRefs = useMergeRefs([ref1, ref2]);
 *   <div ref={mergedRefs}>
 *
 * @example
 *   // Since anonymous functions will cause re-assignment on every render, we can supply
 *   // our own dependency array to control how often it updates.
 *   const mergedRefs = useMergeRefs([ref, (e) => doSomethingWith(el)], []);
 *   <div ref={mergedRefs}>
 */
export default function useMergeRefs<T>(
  refs: ForwardedRef<T>[],
  deps?: any[]
): (value: T | null) => void {
  return useCallback((value: T | null) => {
    refs.forEach((ref) => assignRef(ref, value));
  }, deps ?? refs);
}
