import { AsyncThunkAction } from '@reduxjs/toolkit';
import { useEffect, useMemo } from 'react';
import { Logger } from '@/lib/logger';
import { AppDispatch, useAppDispatch } from '@/store';
import { redactInProd } from '@/utils/strings';

const logger = new Logger('abortable-dispatch');

// Part of the promise returned by dispatching an async thunk
type DispatchPromise = { abort(): void; arg: unknown };

export class AbortError extends Error {}

class AbortableDispatcher {
  private appDispatch: AppDispatch;
  private thunkPromises: Set<DispatchPromise>;
  private controller: AbortController;

  constructor(appDispatch: AppDispatch) {
    this.appDispatch = appDispatch;
    this.thunkPromises = new Set();
    this.controller = new AbortController();
    this.controller.signal.onabort = () => {
      if (this.thunkPromises.size) {
        for (const promise of this.thunkPromises) {
          if (__DEV__) logger.warn('aborting thunk action:', redactInProd(promise.arg));
          promise.abort();
        }
        this.thunkPromises.clear();
      }
    };
  }

  abortPending(reason?: any) {
    this.controller.abort(reason);
    this.controller.signal.onabort = null;
  }

  private throwIfAborted() {
    if (this.controller.signal.aborted) {
      throw new AbortError('Aborted pending thunk');
    }
  }

  /**
   * Dispatches a thunk action and unwraps the return value
   * @returns The return value of the thunk (unwrapped)
   * @throws If the thunk throws or if the action is aborted
   */
  dispatch = async <T, U>(thunkAction: AsyncThunkAction<T, U, any>) => {
    this.throwIfAborted();
    if (__DEV__) logger.debug('dispatch', redactInProd(thunkAction));
    const promise = this.appDispatch(thunkAction);
    this.thunkPromises.add(promise);
    const returnValue = await promise.unwrap();
    this.thunkPromises.delete(promise);
    this.throwIfAborted();
    return returnValue;
  };
}

/**
 * Creates a dispatch function for thunks that aborts any outstanding dispatched thunks on unmount
 * @throws If the thunk throws or is aborted (e.g., unmount), so you must handle errors (.catch or try/catch)
 */
export function useAbortableDispatch() {
  const dispatch = useAppDispatch();
  const abortableDispatcher = useMemo(() => new AbortableDispatcher(dispatch), [dispatch]);

  // clear all on dismount
  useEffect(() => {
    return () => {
      abortableDispatcher.abortPending('unmount');
    };
  }, [abortableDispatcher]);

  return abortableDispatcher.dispatch;
}
