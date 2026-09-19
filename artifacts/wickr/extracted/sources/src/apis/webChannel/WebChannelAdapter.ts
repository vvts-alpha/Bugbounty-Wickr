import memoize from 'lodash/memoize';
import { devErrorTracker } from '@/lib/devErrors';
import { Logger } from '@/lib/logger';
import { tryPromise } from '@/utils/async';
import { WebChannelKey, WickrWebChannels } from './WickrWebChannels';
import { getOrOpenWickrQWebChannels } from './utils';

const logger = new Logger('WebChannelAdapter');

function isSignal(signal: unknown): signal is QSignal<any> {
  return Boolean(
    signal &&
      typeof signal === 'object' &&
      'connect' in signal &&
      typeof signal.connect === 'function' &&
      'disconnect' in signal &&
      typeof signal.disconnect === 'function'
  );
}

function noop() {}

function wrapCallback<S extends { toString: () => string }, A extends any[]>(
  signalName: S,
  callback: (...args: A) => void
) {
  const wrappedCallback = (...args: A) => {
    tryPromise(() => callback(...args)).catch((err) =>
      devErrorTracker.addError(err, `Callback error on signal "${signalName.toString()}"`)
    );
  };
  return wrappedCallback;
}

/**
 * Run a callback when a signal emits
 * @param object The object containing the signal
 * @param signalName The name of the signal, prefixed to any error messsages for better debugging
 * @param callback - The callback fired whenever the signal emits
 * @returns Function to unsubscribe from the signal
 */
function connect<
  T extends Record<string, any>,
  S extends { [P in keyof T]: T[P] extends QSignal<any> ? P : never }[keyof T],
  Args extends T[S] extends QSignal<infer A> ? A : never
>(object: T, signalName: S, callback: (...args: Args) => void): () => void {
  const signal = object[signalName];

  if (!isSignal(signal)) {
    devErrorTracker.addError(
      new Error(`${signalName.toString()} is not a signal`),
      'WebChannelAdapter'
    );
    return noop;
  }

  const wrappedCallback = wrapCallback(signalName, callback);

  logger.debug('connect:', signalName);
  signal.connect(wrappedCallback);

  const disconnect = () => {
    logger.debug('disconnect:', signalName);
    signal.disconnect(wrappedCallback);
  };

  return disconnect;
}

/**
 * Connect to a property change signal and fire the callback immediately to get the initial value
 * @param object The object containing the signal
 * @param signalName The name of the signal, prefixed to any error messsages for better debugging
 * Useful for connecting to properties to get their initial value.
 * @param callback - The callback fired whenever the signal emits, must not take arguments to fire immediately
 * @returns Function to unsubscribe from the signal
 */
function connectProperty<
  T extends Record<string, any>,
  S extends { [P in keyof T]: T[P] extends QSignal<any> ? P : never }[keyof T]
>(object: T, signalName: S, callback: () => void): () => void {
  const wrappedCallback = wrapCallback(signalName, callback);

  // fire immediately
  wrappedCallback();

  const disconnect = connect(object, signalName, wrappedCallback);

  return () => {
    disconnect();
  };
}

export class WebChannelAdapter<K extends WebChannelKey> {
  constructor(private channelKey: K) {}

  /**
   * Get the corresponding internal channel object for the adapter
   * Only use to connect handlers to signals, use the adapter to call channel methods
   * Memoize ensures it always returns the same promise object to avoid unecessary re-renders
   *
   * @returns the stable promise containing the channel
   */
  public whenChannel = memoize(async () => {
    const channel = (await getOrOpenWickrQWebChannels()).objects[this.channelKey];
    if (channel) return channel;
    else throw new Error(`Undefined channel in WebChannelAdapter of type ${this.channelKey}`);
  });

  private connectHelper = <
    S extends {
      [P in keyof WickrWebChannels[K]]: WickrWebChannels[K][P] extends QSignal<any> ? P : never;
    }[keyof WickrWebChannels[K]],
    Args extends WickrWebChannels[K][S] extends QSignal<infer A> ? A : never
  >(
    connectFn: (
      object: WickrWebChannels[K],
      signalName: S,
      callback: (...args: Args) => void
    ) => () => void,
    signalName: S,
    callback: (...args: Args) => void
  ) => {
    const abortController = new AbortController();
    const abortSignal = abortController.signal;

    const cleanupPms = this.whenChannel()
      .then((channel) => {
        if (abortSignal.aborted) return noop;
        else return connectFn(channel, signalName, callback);
      })
      .catch((reason) => {
        devErrorTracker.addError(
          new Error(`Failed to connect to signal ${signalName.toString()}`, { cause: reason })
        );
        return noop;
      });

    return () => {
      abortController.abort();
      cleanupPms.then((cleanup) => cleanup());
    };
  };

  /**
   * Run a callback when a signal emits
   * @param signalName The name of the signal, prefixed to any error messsages for better debugging
   * @param callback - The callback fired whenever the signal emits
   * @returns Function to unsubscribe from the signal
   */
  public connect = <
    S extends {
      [P in keyof WickrWebChannels[K]]: WickrWebChannels[K][P] extends QSignal<any> ? P : never;
    }[keyof WickrWebChannels[K]],
    Args extends WickrWebChannels[K][S] extends QSignal<infer A> ? A : never
  >(
    signalName: S,
    callback: (...args: Args) => void
  ) => this.connectHelper(connect, signalName, callback);

  /**
   * Connect to a property change signal and fire the callback immediately to get the initial value
   * @param signalName The name of the signal, prefixed to any error messsages for better debugging
   * Useful for connecting to properties to get their initial value.
   * @param callback - The callback fired whenever the signal emits, must not take arguments to fire immediately
   * @returns Function to unsubscribe from the signal
   */
  public connectProperty = <
    S extends {
      [P in keyof WickrWebChannels[K]]: WickrWebChannels[K][P] extends QSignal<any> ? P : never;
    }[keyof WickrWebChannels[K]]
  >(
    signalName: S,
    callback: () => void
  ) => this.connectHelper(connectProperty, signalName, callback);
}
