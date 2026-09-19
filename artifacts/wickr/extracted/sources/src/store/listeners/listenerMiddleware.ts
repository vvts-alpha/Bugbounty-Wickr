import {
  ActionCreator,
  AnyAction,
  createListenerMiddleware,
  CreateListenerMiddlewareOptions,
  ListenerMiddlewareInstance,
} from '@reduxjs/toolkit';
import { ThunkExtraArgument } from '../AppStoreProvider';
import { AppRootState } from '../models';
import { Logger } from '@/lib/logger';
import { ILogger } from '@/lib/logger/ILogger';
import { rejectAfter } from '@/utils/async';

const listenerLogger = new Logger('listener-middleware');

export function createAppListenerMiddleware(
  middlewareOptions?: CreateListenerMiddlewareOptions<ThunkExtraArgument>
) {
  return createListenerMiddleware(middlewareOptions);
}

/** https://redux-toolkit.js.org/api/createListenerMiddleware#startlistening */
type StartListeningMiddlewareOptions = {
  type?: string;
  actionCreator?: ActionCreator<AnyAction>;
  matcher?: any;
  predicate?: (
    action: AnyAction,
    currentState?: AppRootState,
    originalState?: AppRootState
  ) => boolean;
};

type AdditionalOptions = {
  /** Timeout (ms) to resolve if no match found */
  timeout?: number;
  /** AbortSignal to resolve if no match found */
  signal?: AbortSignal;
  /** Log warnings */
  logger?: ILogger;
};

export type WhenStoreListenerOptions = StartListeningMiddlewareOptions & AdditionalOptions;

/**
 * Resolves when the listener type/matcher/actionCreator/predicate is fulfilled
 * @returns the matching action, or undefined if the (optional) timeout lapses
 */
export async function whenStoreListener(
  middleware: ListenerMiddlewareInstance,
  { timeout, signal, logger = listenerLogger, ...options }: WhenStoreListenerOptions
) {
  const promise = new Promise<AnyAction>((resolve, reject) => {
    const stop = middleware.startListening({
      effect: (action) => {
        stop();
        resolve(action);
      },
      ...(options as any),
    });
    if (signal) {
      signal.addEventListener('abort', () => {
        stop();
        reject(new Error('Store listener aborted via signal'));
      });
    }
  });
  try {
    // always wrap with rejectAfter, because it handles undefined/0 ms
    return await rejectAfter(promise, timeout);
  } catch (err) {
    // since we catch all errors, at least we can log them
    logger.warn(err);
    return undefined;
  }
}

/**
 * Run callback whenever a thunk is rejected
 * NOTE: This does not necessarily mean the rejection was unhandled
 * @returns Unsubscribe function to stop listening for rejections
 */
export function subscribeRejectedThunks(
  middleware: ListenerMiddlewareInstance,
  callback: (action: AnyAction) => void
) {
  return middleware.startListening({
    predicate: (action) => {
      return action.type.endsWith('/rejected');
    },
    effect: (action) => {
      callback(action);
    },
  });
}
