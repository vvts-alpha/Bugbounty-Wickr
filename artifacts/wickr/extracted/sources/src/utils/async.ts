export const isPromiseLike = <T>(obj: any): obj is PromiseLike<T> =>
  obj && typeof obj === 'object' && typeof obj.then === 'function';

export class TimeoutError extends Error {}

/** Returns the value of the promise, or rejects with an error if timeout elapses, if supplied. */
export async function rejectAfter<T = any>(promise: PromiseLike<T>, timeout?: number) {
  if (timeout && timeout > 0) {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(
          () => reject(new TimeoutError(`Promise took longer than ${timeout}ms to resolve`)),
          timeout
        )
      ),
    ]);
  } else {
    return promise;
  }
}

export function withTimeout<F extends (...args: any[]) => Promise<any>>(
  asyncFn: F,
  timeout?: number
): F {
  return ((...args: Parameters<F>) => {
    const promise: Promise<ReturnType<F>> = asyncFn(...args);
    return rejectAfter(promise, timeout);
  }) as F;
}

/** Resolves after millisecond delay */
export function delay(ms = 0): Promise<void> {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

/** Resolves after requestIdleCallback runs */
export function whenRequestIdleCallback<F extends (deadline: IdleDeadline) => any>(
  callback: F,
  options?: IdleRequestOptions
): Promise<ReturnType<F>> {
  return new Promise((resolve) => {
    requestIdleCallback((deadline) => {
      resolve(callback(deadline));
    }, options);
  });
}

/**
 * Polyfill for Promise.try
 * @param maybeAsyncFn - Function is called immediately and the result is wrapped in a promise.
 * @returns The return value of maybeAsyncFn wrapped in a Promise
 * Useful for cases where you do not know if the function is sync or async
 * https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/try
 * https://github.com/tc39/proposal-promise-try?tab=readme-ov-file
 * @example
 * function emitEvent(event: any, callback: (e: any) => any) {
 *   // handle all errors with catch(), even if the callback isn't async
 *   tryPromise(() => callback(event)).catch(handleError)
 * }
 */
export function tryPromise<F extends AnyFunction>(maybeAsyncFn: F): Promise<ReturnType<F>> {
  return new Promise((resolve) => resolve(maybeAsyncFn()));
}
