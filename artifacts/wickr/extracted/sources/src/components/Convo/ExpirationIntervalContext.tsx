import { createContext, useContext, useEffect, useLayoutEffect, useReducer, useState } from 'react';
import useLatestCallback from '@/hooks/useLatestCallback';
import { skewMilliseconds } from '@/utils/date';
import { SafeIntervalCanceller, safeInterval } from '@/utils/safeInterval';

export class ExpirationIntervalEmitter {
  private cancelSafeInterval?: SafeIntervalCanceller;

  private handlers = new Set<(nowSkewedCorrected: number) => any>();

  onInterval = (callback: (nowSkewedCorrected: number) => any) => {
    this.cancelSafeInterval ??= safeInterval(() => {
      const nowSkewCorrected = skewMilliseconds(Date.now());
      this.handlers.forEach((cb) => cb(nowSkewCorrected));
    }, 1000);
    this.handlers.add(callback);
    return () => {
      this.handlers.delete(callback);
      if (this.handlers.size === 0 && this.cancelSafeInterval) {
        this.cancelSafeInterval();
        delete this.cancelSafeInterval;
      }
    };
  };
}

const emitter = new ExpirationIntervalEmitter();

if (__DEV__) Object.assign(globalThis, { _expiresEmitter: emitter });

export const ExpirationIntervalContext = createContext<ExpirationIntervalEmitter>(emitter);

type Unsubscribe = () => void;

/**
 * Shared timer that updates all expiration times on the same tick.
 * The callback is passed the current time with skew correction applied
 * */
export const useExpirationInterval = (
  callback: (nowSkewCorrected: number) => void
): Unsubscribe => {
  const { onInterval } = useContext(ExpirationIntervalContext);
  const stableCallback = useLatestCallback(callback);
  const [didUnsubscribe, unsubscribe] = useReducer(() => true, false);
  useLayoutEffect(() => {
    if (didUnsubscribe) return;
    // fire right away (similar to useEffect), and then on interval
    stableCallback(Date.now());
    const stop = onInterval(stableCallback);
    return stop;
  }, [didUnsubscribe, stableCallback, onInterval]);
  return unsubscribe;
};

/**
 * Track a date until it is in the past
 * @param expirationDate Date in milliseconds
 */
export const useIsExpired = (expirationDate: number): boolean => {
  const [isExpired, setIsExpired] = useState(() => expirationDate < skewMilliseconds(Date.now()));
  const unsubscribe = useExpirationInterval((now) => {
    setIsExpired(expirationDate < now);
  });
  useEffect(() => {
    if (isExpired) unsubscribe();
  }, [isExpired, unsubscribe]);
  return isExpired;
};
