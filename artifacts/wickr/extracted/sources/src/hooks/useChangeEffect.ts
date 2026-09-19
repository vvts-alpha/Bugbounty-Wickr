import { DependencyList, EffectCallback, useEffect, useLayoutEffect, useRef } from 'react';

/**
 * useEffect runs on initial rendering, use this if you want to skip that
 */
export default function useChangeEffect(callback: EffectCallback, dependencies: DependencyList) {
  const isMounted = useRef(false);

  useEffect(() => {
    if (!isMounted.current) {
      isMounted.current = true;
    } else {
      return callback();
    }
  }, dependencies);
}

export function useChangeLayoutEffect(callback: EffectCallback, dependencies: DependencyList) {
  const isMounted = useRef(false);

  useLayoutEffect(() => {
    if (!isMounted.current) {
      isMounted.current = true;
    } else {
      return callback();
    }
  }, dependencies);
}
