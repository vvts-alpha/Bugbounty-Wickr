import { MutableRefObject, useEffect, useRef } from 'react';
import useLatestCallback from '@/hooks/useLatestCallback';

type MaybeElement = Element | undefined | null;

export type SetIntersectionRef = (element?: MaybeElement) => void;

export type IntersectionObserverEntryAndData<T> = {
  entry?: IntersectionObserverEntry;
  data?: T;
};

type Callback<T> = (entriesData: IntersectionObserverEntryAndData<T>[]) => void;

export function createIntersectionObserverHooks<T = undefined>() {
  const observerEntries = new WeakMap<Element, MutableRefObject<T | undefined>>();
  let observerCount = 0;
  const callbacks = new Set<Callback<T>>();

  const intersectionObserver = new IntersectionObserver((entries) => {
    // this is to address a very rare case that we might encounter duplicate entries for the same observation target
    // it usually happens when main thread is busy, when it happens, we want to keep the last occurrence as the source of truth
    entries = entries.reduceRight(
      (result, entry) => {
        // reduce, but in reverse order, because we want to keep last occurrence of duplicated entries
        if (!result.seenList.has(entry.target)) {
          // first time seen the observed element
          result.seenList.add(entry.target); // add it to seen list
          result.entries.unshift(entry); // insert the entry at the start of an array, so that it preserves the original order
        }
        return result;
      },
      { entries: [] as IntersectionObserverEntry[], seenList: new Set() }
    ).entries;

    const entriesData = entries.map((entry) => {
      const data = observerEntries.get(entry.target);
      return { entry, data: data?.current };
    });

    callbacks.forEach((cb) => cb(entriesData));
  });

  /**
   * Custom hook for observing intersections of a specific element
   *
   * @param data Optional data attached to the observation, this data will be passed back in callbacks
   *        when the observed element's visibility changes
   * @returns A `setRef` function. This function can be used to set the reference to the DOM element
   *          that needs to be observed
   *
   * It sets up an intersection observer on the specified element and cleans up when the component
   * unmounts or the observed element changes. The cleanup process includes notifying all registered
   * callbacks with an `undefined` entry to indicate that the observed component is no longer mounted
   */
  const useIntersectionObserve = (data?: T) => {
    const elementRef = useRef<MaybeElement>(null);
    const dataRef = useRef<T | undefined>(data);

    if (dataRef.current !== data) {
      dataRef.current = data;
    }

    const unobserve = () => {
      if (!elementRef.current) return;
      // get data attached to the observe element
      const data = observerEntries.get(elementRef.current);
      if (observerEntries.delete(elementRef.current)) {
        observerCount--;
      }
      intersectionObserver.unobserve(elementRef.current);
      // fire callback on ref change or component unmount
      callbacks.forEach((callback) => callback([{ entry: undefined, data: data?.current }]));
      if (observerCount === 0) {
        // disconnect when observing nothing to prevent memory leaks in older Chrome
        // https://issues.chromium.org/issues/40772627
        intersectionObserver.disconnect();
      }
    };

    const setRef = useLatestCallback<SetIntersectionRef>((element) => {
      if (elementRef.current === element) return;
      // unobserve current element on ref change
      unobserve();
      elementRef.current = element;
      if (!element) return;
      // increment count if we are not observing it yet
      if (!observerEntries.has(element)) {
        observerCount++;
      }
      // associate element to given data
      observerEntries.set(element, dataRef);
      intersectionObserver.observe(element);
    });

    return setRef;
  };
  /**
   * Custom hook to register a callback for intersection events
   *
   * @param callback A callback will be called with intersection entry info and the data
   *                 we passed to useIntersectionObserve
   *
   * This hook is designed to be used in conjunction with the `useIntersectionObserve` hook.
   * It allows a component to specify a callback that will be invoked whenever an observed
   * component's visibility changes or when the observed component is no longer mounted
   */
  const useIntersectionCallback = (callback: Callback<T>) => {
    const latestCallback = useLatestCallback(callback);

    useEffect(() => {
      callbacks.add(latestCallback);
      return () => {
        callbacks.delete(latestCallback);
      };
    }, [latestCallback]);
  };

  return {
    useIntersectionObserve,
    useIntersectionCallback,
  };
}
