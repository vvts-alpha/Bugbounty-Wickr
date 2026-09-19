/* eslint import/order: off */
/**
 *  Bootstrap file to set up and load the proper configuration for the entire application.
 */
import { Logger } from './lib/logger';
import { ConsoleLogger } from './lib/logger/ConsoleLogger';
import { safeInterval } from './utils/safeInterval';
import { minutesToMilliseconds } from 'date-fns';
import { MemoryLogger } from './lib/logger/MemoryLogger';
import { SplitLogger } from './lib/logger/SplitLogger';

if (__DEV__) {
  // console.timeStamp is typically used with the Performance tab. This extends it to
  // show the results in the console. It also assigns all calls to a global so you can
  // quickly inspect it, e.g., with console.table(_timeStamps)
  const timeStamps: { label: string; time: number; delta: number }[] = [];
  const timeStamp = console.timeStamp.bind(console);
  console.timeStamp = (label: string) => {
    timeStamp(label);
    const time = performance.now();
    console.info('@@time:', label, time);
    const prev = timeStamps[timeStamps.length - 1];
    const delta = prev ? time - prev.time : 0;
    timeStamps.push({ label, time, delta });
  };
  Object.assign(globalThis, { _timeStamps: timeStamps });
}

// Qt picks up everything we log to the console
const logger = __DEV__
  ? new SplitLogger([new ConsoleLogger(), new MemoryLogger(100)])
  : new ConsoleLogger();
Logger.setDefaultTransport(logger);

if (__DEV__) {
  Logger.setDefaultLogLevel('debug');
}

if (!__DEV__) {
  // clear console periodically as an attempt to prevent memory leak
  safeInterval(() => {
    logger.clear();
  }, minutesToMilliseconds(10));
}

if (__DEV__) {
  Object.assign(globalThis, { _Logger: Logger });
  Object.defineProperty(globalThis, '_logger', {
    get() {
      return Logger.getDefaultTransport();
    },
  });
}
