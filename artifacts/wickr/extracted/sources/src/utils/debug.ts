import memoize from 'fast-memoize';
import tap from 'lodash/tap';
import { getOrOpenWickrQWebChannels } from '@/apis/webChannel/utils';
import { Logger } from '@/lib/logger';
import { ILogger } from '@/lib/logger/ILogger';
import { WickrMessage } from '@/lib/protobuf/messages';
import { AppStore } from '@/store';
import { average, truncateFloat } from './math';

export const ARGS_PREFIX = 'args:';
export const RETURNS_PREFIX = 'returns:';

const noop = () => {};

export function spyMethod<T extends AnyObject>(
  obj: T,
  prop: keyof T,
  {
    thisObj = obj,
    onBefore = noop,
    onAfter = noop,
  }: {
    thisObj?: any;
    onBefore?: (prop: keyof T, args: Parameters<(typeof obj)[typeof prop]>) => void;
    onAfter?: (
      prop: keyof T,
      args: Parameters<(typeof obj)[typeof prop]>,
      returnValue: Awaited<ReturnType<(typeof obj)[typeof prop]>>
    ) => void;
  } = {}
) {
  let restore = noop;
  const originalFn = obj[prop];
  if (typeof originalFn === 'function') {
    const fn = originalFn.bind(thisObj);
    obj[prop] = ((...args: Parameters<(typeof obj)[typeof prop]>) => {
      onBefore(prop, args);
      const returnValue = fn(...args);
      if (returnValue && typeof returnValue.then === 'function') {
        returnValue.then((value: any) => onAfter(prop, args, value));
      } else {
        onAfter(prop, args, returnValue);
      }
      return returnValue;
    }) as (typeof obj)[typeof prop];

    restore = () => (obj[prop] = originalFn);
  }
  return { restore };
}

export function logMethod<T extends AnyObject>(
  obj: T,
  prop: keyof T,
  logger: ILogger,
  thisObj = obj
) {
  return spyMethod(obj, prop, {
    onBefore: (prop, args) => logger.info(prop, ARGS_PREFIX, ...args),
    onAfter: (prop, _, returnValue) => logger.info(prop, RETURNS_PREFIX, returnValue),
    thisObj,
  });
}

export function logOwnMethodCalls<T extends AnyObject>(
  obj: T,
  logger: ILogger,
  ignoreMethods: (keyof T)[] = []
) {
  const thisObj = obj;
  const proto = obj?.constructor?.prototype;
  if (proto && typeof proto == 'object' && proto !== Object.prototype) {
    obj = proto;
  }
  ignoreMethods = ignoreMethods.concat(['constructor']);
  const props = Object.getOwnPropertyNames(obj).filter((prop) => !ignoreMethods.includes(prop));
  const spies = props.map((prop) => logMethod(obj, prop, logger, thisObj));
  return {
    restore: () => spies.forEach((spy) => spy.restore()),
  };
}

export function logMethods<T extends AnyObject>(obj: T, logger: ILogger, methods: (keyof T)[]) {
  const thisObj = obj;
  const proto = obj?.constructor?.prototype;
  if (proto && typeof proto == 'object' && proto !== Object.prototype) {
    obj = proto;
  }
  const props = Object.getOwnPropertyNames(obj).filter((prop) => methods.includes(prop));
  const spies = props.map((prop) => logMethod(obj, prop, logger, thisObj));
  return {
    restore: () => spies.forEach((spy) => spy.restore()),
  };
}

/** Log a value and return it */
export const logTap =
  <T>(message: string, log: (...args: any[]) => void) =>
  <S extends T>(value: S) =>
    tap<S>(value, (value) => log(message, value));

const ABC = 'abcdefghijklmnopqrstuvwxyz';

/** "hash" a value to a letter in the alphabet */
const toLetter = memoize((_: any) => ABC[Math.floor(Math.random() * ABC.length)]);

/** PII-safe message meta logging helper */
export function safeMessagesMeta(messages: WickrMessage[], selfHash?: string) {
  return messages.map(
    ({
      inReplyTo,
      isRead,
      msgId,
      outbox,
      outboxStatus,
      reactions,
      retryCount,
      senderHash,
      textContent,
      timeStamp,
      type,
      vGroupID,
    }) => {
      const fromSelf = selfHash && selfHash === senderHash;
      const outboxSelfConsistent = !!fromSelf === !!outbox;
      return {
        fromSelf,
        inReplyTo,
        isRead,
        msgId,
        outbox,
        outboxStatus,
        reactions: reactions.map(({ identifier, userIDs }) => ({
          identifier: toLetter(identifier),
          userIDs,
        })),
        retryCount,
        senderHash,
        textContent: !!textContent,
        timeStamp,
        type,
        vGroupID,
        outboxSelfConsistent,
      };
    }
  );
}

if (__DEV__) {
  // These are no use being exported, as they only work when called from the console itself
  const _allEventsCount = () => {
    const getEventListeners = (globalThis as any).getEventListeners;
    const all: any = { _total: -1 };
    if (!getEventListeners) return all;
    return [window, document, ...document.querySelectorAll('*')].reduce(function (pre, dom) {
      const evtObj = getEventListeners(dom);
      Object.keys(evtObj).forEach((evt) => {
        if (typeof pre[evt] === 'undefined') {
          pre[evt] = 0;
        }
        pre[evt] += evtObj[evt].length;
        pre._total++;
      });
      return pre;
    }, all);
  };

  const _totalEventsCount = () => {
    return _allEventsCount()._total;
  };

  Object.assign(window, { _allEventsCount, _totalEventsCount });
}

export function getMemoryInfo(): {
  totalJSHeapSize: number;
  usedJSHeapSize: number;
  jsHeapSizeLimit: number;
} {
  const memory = (performance as any)?.memory;
  return {
    totalJSHeapSize: memory?.totalJSHeapSize ?? 0,
    usedJSHeapSize: memory?.usedJSHeapSize ?? 0,
    jsHeapSizeLimit: memory?.jsHeapSizeLimit ?? 0,
  };
}

/** Track the frame rate for a given interval and log the results */
export function trackFrameRate(interval: number, logger: ILogger) {
  let canceled = false;
  const start = performance.now();
  let previousTime = start;
  const rates: number[] = [];
  const chunks: number[][] = [];

  function run() {
    const now = performance.now();
    const delta = now - previousTime;
    const fps = 1 / (delta / 1000);
    previousTime = now;
    rates.push(fps);
    const elapsed = now - start;
    // bucket into every 10% of time
    const bucketIndex = Math.floor((elapsed / interval) * 10);
    chunks[bucketIndex] = chunks[bucketIndex] || [];
    chunks[bucketIndex].push(fps);
    if (!canceled && elapsed < interval) {
      // eslint-disable-next-line no-restricted-syntax
      requestAnimationFrame(run);
    } else {
      const max = truncateFloat(Math.max(...rates));
      const min = truncateFloat(Math.min(...rates));
      const avg = average(rates);
      const med = truncateFloat(rates.slice().sort()[Math.floor(rates.length / 2)]);
      const bucketAvg = chunks.map((chunk) => average(chunk));
      const bucketFrames = chunks.map((chunk) => chunk.length);
      logger.info('trackFrameRate:', {
        elapsed,
        min,
        max,
        avg,
        med,
        rates,
        bucketAvg,
        bucketFrames,
        canceled,
      });
    }
  }
  // eslint-disable-next-line no-restricted-syntax
  requestAnimationFrame(run);
  return () => {
    canceled = true;
  };
}

export function addConsoleTools(store: AppStore, autoActivate?: boolean): AnyFunction {
  const qtObj = (globalThis as any).qt;

  if (!qtObj) {
    return () => {};
  }

  const logger = new Logger('console-tools');

  let consoleToolsEnabled = false;

  // track all the globals we assign for easy cleanup
  const globalKeys = new Set<string>();
  function assignGlobal(key: string, value: any) {
    if (consoleToolsEnabled) {
      (globalThis as any)[key] = value;
      globalKeys.add(key);
      logger.info('dbg++:', key);
    }
  }

  const addDebugTools = () => {
    if (consoleToolsEnabled) return;
    consoleToolsEnabled = true;
    assignGlobal('_store', store);
    getOrOpenWickrQWebChannels().then((qChannel) => {
      assignGlobal('_channels', qChannel.objects);
    });
    import('@/apis/webFetch').then((apisModule) => {
      assignGlobal('_api', { ...apisModule });
    });
    import('@/store/dev-utils').then(({ getStoreActionsAndSelectors }) => {
      const storeUtils = getStoreActionsAndSelectors();
      Object.entries(storeUtils).forEach(([key, value]) => assignGlobal(key, value));
    });
  };

  const removeDebugTools = () => {
    if (!consoleToolsEnabled) return;
    logger.info('dbg--:', ...globalKeys);
    consoleToolsEnabled = false;
    globalKeys.forEach((key) => {
      delete (globalThis as any)[key];
    });
    globalKeys.clear();
  };

  qtObj.debug = () => {
    if (consoleToolsEnabled) removeDebugTools();
    else addDebugTools();
  };

  if (autoActivate) {
    addDebugTools();
  }

  return () => {
    removeDebugTools();
    delete qtObj.debug;
  };
}
