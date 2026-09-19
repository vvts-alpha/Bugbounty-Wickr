import { minutesToMilliseconds } from 'date-fns';
import { useEffect } from 'react';
import { useWebChannel } from '../context';
import { devErrorTracker } from '@/lib/devErrors';
import { Logger } from '@/lib/logger';
import { useAppDispatch } from '@/store';
import { setSetting } from '@/store/slices/settings';
import {
  getClockSkewMilliseconds,
  microsecondsToMilliseconds,
  setClockSkewMilliseconds,
} from '@/utils/date';
import { safeInterval } from '@/utils/safeInterval';

const CLOCK_SKEW_GREATER_THAN_MS = 10_000;

const logger = new Logger('SyncAppClock');

// Subscribes to app clock signals/properties and connects the handlers
export const SyncAppClock = () => {
  const { bridge } = useWebChannel();
  const dispatch = useAppDispatch();

  useEffect(() => {
    const syncAppClock = async () => {
      // start measure the latency of getAppClock()
      const startTime = Date.now();
      const serverTimeMicroseconds = await bridge.getAppClock();
      const serverTime = microsecondsToMilliseconds(serverTimeMicroseconds);
      const localTime = Date.now();
      const latency = localTime - startTime;
      // assume the latency is symmetrical, add one way trip time to serverTime
      const clockSkew = localTime - Math.round(serverTime + latency / 2);
      setClockSkewMilliseconds(clockSkew);
      const previousClockSkew = getClockSkewMilliseconds();
      const skewDelta = Math.abs(clockSkew - previousClockSkew);
      if (skewDelta > CLOCK_SKEW_GREATER_THAN_MS) {
        // this means that all old timestamps are out of date; this should be a metric
        logger.warn(
          'clock is drifting more than',
          Math.trunc(CLOCK_SKEW_GREATER_THAN_MS / 1000),
          'seconds!',
          skewDelta
        );
      }
      logger.debug('getAppClock: Diff between now and then', {
        localTime,
        serverTime,
        latency,
        clockSkew,
        previousClockSkew,
      });
    };

    const safeIntervalCanceller = safeInterval(syncAppClock, minutesToMilliseconds(15));

    syncAppClock().catch((reason) => {
      devErrorTracker.addError(new Error('Failed to sync clock', { cause: reason }));
    });

    bridge.use12HourFormat().then(
      (use12HourFormat) => {
        dispatch(setSetting('use12HourFormat', use12HourFormat));
      },
      (reason) => {
        devErrorTracker.addError(new Error('Failed to use 12 hour format', { cause: reason }));
      }
    );

    return () => {
      safeIntervalCanceller();
    };
  }, [bridge, dispatch]);

  return null;
};
