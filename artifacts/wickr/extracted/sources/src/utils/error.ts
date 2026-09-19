import { Logger } from '@/lib/logger';

const logger = new Logger('utils/error');

/** Convert anything into an error safely */
export class SafeError extends Error {
  constructor(error: any) {
    super(
      isErrorLike(error)
        ? error.message
        : typeof error === 'string'
        ? error
        : typeof error === 'symbol'
        ? error.toString()
        : `${error}`
    );
    if (error?.name) this.name = error.name;
    if (error?.stack) this.stack = error.stack;
    this.cause = error;
  }
}

/** Add a prefix and/or suffix to an existing error */
export class AmendedError extends SafeError {
  constructor(error: any, { prefix, suffix }: { prefix?: string; suffix?: string } = {}) {
    super(`${prefix ?? ''}${isErrorLike(error) ? error.message : error}${suffix ?? ''}`);
    if (isErrorLike(error)) {
      if (error.name) this.name = error.name;
      if (error.stack) this.stack = error.stack;
    }
    this.cause = error;
  }
}

/** Add a prefix to an existing error */
export class PrefixedError extends AmendedError {
  constructor(prefix: string, error: any) {
    super(error, { prefix });
  }
}

/** Add a suffix to an existing error */
export class SuffixedError extends AmendedError {
  constructor(suffix: string, error: any) {
    super(error, { suffix });
  }
}

type ErrorLike = {
  message: string;
  name?: string;
  stack?: string;
};

/** Detect if any value is like an Error */
export function isErrorLike(error: any): error is ErrorLike {
  return (
    error instanceof Error ||
    (Boolean(error) &&
      typeof error === 'object' &&
      typeof error.message === 'string' &&
      ['string', 'undefined'].includes(typeof error.name) &&
      ['string', 'undefined'].includes(typeof error.stack))
  );
}

/**
 * Safely convert any value into an error.
 * If the original argument is an error already, it is returned as-is.
 * If it is converted to an error, the original value is set as the error cause.
 */
export function toError(error: Error | ErrorLike | string | unknown): Error {
  if (error instanceof Error) return error;
  if (typeof error === 'string') return new Error(error);
  if (isErrorLike(error)) return new SafeError(error);
  // fallback to stringifying
  let errorString = '';
  try {
    errorString = JSON.stringify(error);
  } catch {
    errorString = 'Error';
  }
  return new Error(errorString, { cause: error });
}

/** Log an error in the dev banner and console, but do not break the app */
export function logDevError(errorOrMessage: Error | string | any, logr = logger) {
  if (__DEV__) {
    const error = new PrefixedError('[logDevError] ', errorOrMessage);
    const errorEvent = new ErrorEvent('error', { error });
    // this will be displayed in the dev banner, but logger doesn't show trace
    dispatchEvent(errorEvent);
    // log to get a proper trace in the console
    logr.error(error);
  }
}

let logOnceMessages: Set<string>;
/** Log an error once during development */
export function logDevErrorOnce(anything: any, logr = logger) {
  if (__DEV__) {
    const error = toError(anything);
    const { message } = error;
    logOnceMessages ??= new Set();
    if (!logOnceMessages.has(message)) {
      logOnceMessages.add(message);
      logDevError(error, logr);
    }
  }
}

if (__DEV__) {
  Object.assign(globalThis, {
    _err: {
      SafeError,
      AmendedError,
      PrefixedError,
      SuffixedError,
      isErrorLike,
      toError,
      logDevError,
      logDevErrorOnce,
    },
  });
}
