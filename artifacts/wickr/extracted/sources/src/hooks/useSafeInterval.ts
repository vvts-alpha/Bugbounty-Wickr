import { useEffect } from 'react';
import { safeInterval } from '@/utils/safeInterval';
import useLatestCallback from './useLatestCallback';

export default function useSafeInterval(callback: AnyFunction, timeout: number) {
  const cb = useLatestCallback(callback);

  useEffect(() => {
    const unsubscribe = safeInterval(cb, timeout);
    return () => unsubscribe();
  }, [timeout]);
}
