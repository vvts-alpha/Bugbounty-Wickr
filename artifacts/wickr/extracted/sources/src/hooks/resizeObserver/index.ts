import { useDeferredValue, useEffect, useState } from 'react';
import useLatestCallback from '../useLatestCallback';
import { ObjectEmitter } from '@/utils/ObjectEmitter';

type MaybeElement = Element | undefined | null;

type SetResizeRef = (element?: MaybeElement) => void;

type ResizeEntryCallback = (entry: ResizeObserverEntry) => any;

type Resized = [SetResizeRef, ResizeObserverEntry | undefined];

type UseOnResized = (
  callback?: ResizeEntryCallback,
  options?: ResizeObserverOptions
) => SetResizeRef;
type UseResized = (options?: ResizeObserverOptions) => Resized;
type UseResizeObserverCallback = (callback: ResizeObserverCallback) => void;
type DisconnectResizer = () => void;
type ResizeObserverHooks = {
  /**
   * Fire the callback when the target is resized. Re-renders are only caused when updating the ref
   * @returns A function to set/unset the Element ref that we want to observe
   */
  useOnResized: UseOnResized;
  /** Track element resize and update state when the entry changes */
  useResized: UseResized;
  /** Subscribe to the ResizeObserverCallback of the ResizeObserver, used for observing all entries */
  useResizeObserverCallback: UseResizeObserverCallback;
  /** Disconnect the ResizeObserver; not generally necessary, as hooks manage lifecycle */
  disconnect: DisconnectResizer;
};

const serializeOptions = ({ box = 'content-box' }: ResizeObserverOptions = {}) => {
  // default is "content-box". Not using JSON.stingify because it cannot handle default case or extra arguments
  return `box_${box}`;
};

const noop = () => {};

/** Create resize hooks that share the same ResizeObserver */
export function createResizeObserverHooks(): ResizeObserverHooks {
  let resizeObserver: ResizeObserver | undefined;
  const elementEmitter = new ObjectEmitter<Element, ResizeObserverEntry>();
  const resizeObserverCallbacks = new Set<ResizeObserverCallback>();

  // I tested different options.box, but they don't actual change what is reported.
  // If they reported different values, then we would need to have an observer
  // on a per-options basis. It's possible, but it doesn't seem to matter.
  const useOnResized: UseOnResized = (callback = noop, options = {}) => {
    const [element, setElement] = useState<MaybeElement>(null);
    const cb = useLatestCallback(callback);

    useEffect(() => {
      if (!element) {
        return;
      }

      if (!resizeObserver) {
        resizeObserver = new ResizeObserver((entries, observer) => {
          resizeObserverCallbacks.forEach((callback) => callback(entries, observer));
          entries.forEach((entry) => {
            elementEmitter.emit(entry.target, entry);
          });
        });
      }

      // observe
      const ro = resizeObserver;
      ro.observe(element, options);
      const unsubscribe = elementEmitter.on(element, cb);

      // unobserve
      return () => {
        ro.unobserve(element);
        unsubscribe();
        if (elementEmitter.allListenersCount() === 0) {
          disconnect(ro);
        }
      };
    }, [cb, element, serializeOptions(options)]);

    return setElement;
  };

  const useResized: UseResized = (options: ResizeObserverOptions = {}) => {
    const [entry, setEntry] = useState<ResizeObserverEntry | undefined>();
    const setElement = useOnResized(setEntry, options);
    const dfdEntry = useDeferredValue(entry);
    return [setElement, dfdEntry];
  };

  const useResizeObserverCallback: UseResizeObserverCallback = (
    callback: ResizeObserverCallback
  ) => {
    const cb = useLatestCallback(callback);

    useEffect(() => {
      resizeObserverCallbacks.add(cb);
      return () => {
        resizeObserverCallbacks.delete(cb);
      };
    }, []);
  };

  const disconnect = (ro = resizeObserver): void => {
    if (ro) {
      ro.disconnect();
    }
    if (ro === resizeObserver) {
      resizeObserver = undefined;
      elementEmitter.clearAll();
    }
  };

  return {
    useOnResized,
    useResized,
    useResizeObserverCallback,
    disconnect,
  };
}

// Only expose hooks that make sense for general use,
// i.e., no one should useResizeObserverCallback and disconnect in the global scope
export const { useOnResized, useResized } = createResizeObserverHooks();
