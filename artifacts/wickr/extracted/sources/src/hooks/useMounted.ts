import { useRef, useEffect, useCallback } from 'react';

/**
 * Returns a function which, when called, returns true if the component is mounted,
 * false otherwise.
 * @example
 * const isMounted = useMounted();
 * useEffect(() => {
 *   fetch(...).then((res) => {
 *     if(isMounted()) setState(...);
 *   });
 * });
 */
export default function useMounted() {
  const isMounted = useRef(true);

  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  return useCallback(() => isMounted.current, []);
}
