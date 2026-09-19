import { Emitter, StateTransition } from '@amzn/async-utils';
import { isPromiseLike } from '@/utils/async';
import { PrefixedError } from '@/utils/error';
import MetricTimer from './MetricTimer';
import { MetricName, AddMetrics } from './models';

function isDefined<T>(value: T | undefined): value is T {
  return value !== undefined;
}

type TimeFunctionOptions<F extends AnyFunction> = Partial<{
  details: (args: Parameters<F>, res?: Awaited<ReturnType<F>>, err?: any) => AnyObject;
  ignoreErrors: boolean;
}>;

type TimePromiseOptions<T, K extends MetricName> = Partial<{
  /** Create details for the metric based on the return value/error. */
  details: ((res?: T, err?: any) => AnyObject) | AnyObject;
  timer: MetricTimer<K>;
  ignoreErrors: boolean;
}>;

export class Metrics extends Emitter<{ error: Error }> {
  private readonly metricsHandler = new StateTransition<AddMetrics | undefined>(undefined);

  private emitError = (error: any) => {
    this.emit('error', new PrefixedError('MetricsHandler ', error));
  };

  setAddMetricsHandler = (addMetricsHandler: AddMetrics) => {
    this.metricsHandler.next(addMetricsHandler);
  };

  addMetrics: AddMetrics = async (name, details) => {
    await this.metricsHandler
      .when(isDefined)
      .then((handler) => handler(name, details))
      .catch(this.emitError);
  };

  addCount = (name: MetricName, count = 1, details?: AnyObject) => {
    this.addMetrics(name, { ...details, count });
  };

  /**
   * Start a MetricTimer for the given MetricName
   */
  startTimer = <K extends MetricName>(name: K): MetricTimer<K> => {
    return new MetricTimer(this, name);
  };

  /**
   * Wraps an existing function and records a metric for the time it takes for the function to run.
   * Works with sync and async functions. Does not affect arguments or return value of original function.
   * @returns a wrapped version of the original function
   */
  timeFunction = <F extends AnyFunction>(
    name: MetricName,
    fn: F,
    { details, ignoreErrors }: TimeFunctionOptions<F> = {}
  ): F => {
    return ((...args: Parameters<F>): ReturnType<F> => {
      const timer = this.startTimer(name);
      try {
        const returnValue: ReturnType<F> = fn(...args);
        if (isPromiseLike(returnValue)) {
          // If it's a promise, time the promise (the actual promise is returned from timePromise, so return value is unaffected)
          return this.timePromise(name, returnValue, {
            details: details
              ? (res?: Awaited<ReturnType<F>>, err?: any) => details(args, res, err)
              : undefined,
            timer,
            ignoreErrors,
          }) as ReturnType<F>;
        } else {
          // If it's a sync function, stop time timer and return the value
          timer.stop(details?.(args, returnValue));
          return returnValue;
        }
      } catch (err) {
        // since we don't await the promise, we only get here if a sync function throws
        if (!ignoreErrors) {
          timer.stop(details?.(args, undefined, err));
        }
        throw err;
      }
    }) as F;
  };

  /**
   * Add a metric for the time it takes for a promise to resolve.
   * Does not affect the resolution of the original promise.
   * @returns the original promise
   */
  timePromise = <T, K extends MetricName>(
    name: K,
    promise: PromiseLike<T>,
    { details, timer, ignoreErrors }: TimePromiseOptions<T, K> = {}
  ): PromiseLike<T> => {
    const localTimer = timer || this.startTimer(name);
    promise.then(
      (res) =>
        localTimer.stop(
          details ? (typeof details === 'function' ? details(res) : details) : undefined
        ),
      (err) =>
        ignoreErrors
          ? true
          : localTimer.stop(
              details
                ? typeof details === 'function'
                  ? details(undefined, err)
                  : details
                : undefined
            )
    );
    return promise;
  };
}
