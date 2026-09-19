import { RefObject, useEffect } from 'react';
import useLatestCallback from './useLatestCallback';

let signalId = 1;
const signalWeakMap = new WeakMap<AbortSignal, number>();

/** Convert options into stable serialized value for effect comparison */
function serializeOptions(options: boolean | AddEventListenerOptions | undefined) {
  if (typeof options !== 'object') return options;

  // sorted to create stable output (JSON is not stable)
  return Object.keys(options)
    .sort()
    .map((key) => {
      let value: any = options[key as keyof AddEventListenerOptions];
      if (key === 'signal' && value instanceof AbortSignal) {
        let id = signalWeakMap.get(value);
        if (!id) {
          id = signalId++;
          signalWeakMap.set(value, id);
        }
        value = id;
      }
      return `${key}:${value}`;
    })
    .join(',');
}

// Modified version of https://usehooks-ts.com/react-hook/use-event-listener:
// 1. Requires element as first parameter to never infer window
// 2. Accepts an element or ref for each type
// TODO: does not work if the value of the ref changes, which is an atypical case in react

// MediaQueryList Event based useEventListener interface
function useEventListener<K extends keyof MediaQueryListEventMap>(
  element: RefObject<MediaQueryList> | MediaQueryList | undefined,
  eventName: K,
  handler: (event: MediaQueryListEventMap[K]) => void,
  options?: boolean | AddEventListenerOptions
): void;

// Window Event based useEventListener interface
function useEventListener<K extends keyof WindowEventMap>(
  element: RefObject<Window> | Window | undefined,
  eventName: K,
  handler: (event: WindowEventMap[K]) => void,
  options?: boolean | AddEventListenerOptions
): void;

// Element Event based useEventListener interface
function useEventListener<
  K extends keyof HTMLElementEventMap,
  T extends HTMLElement = HTMLDivElement
>(
  element: RefObject<T> | T | undefined,
  eventName: K,
  handler: (event: HTMLElementEventMap[K]) => void,
  options?: boolean | AddEventListenerOptions
): void;

// Document Event based useEventListener interface
function useEventListener<K extends keyof DocumentEventMap>(
  element: RefObject<Document> | Document | undefined,
  eventName: K,
  handler: (event: DocumentEventMap[K]) => void,
  options?: boolean | AddEventListenerOptions
): void;

/**
 * Custom hook for attaching event listeners to DOM elements, the window, or media query lists.
 * If no valid target is given (e.g., undefined) no listener is attached.
 * @template KW - The type of event for window events.
 * @template KH - The type of event for HTML element events.
 * @template KM - The type of event for media query list events.
 * @template T - The type of the DOM element (default is `HTMLElement`).
 * @param {RefObject<T>} [element] - The DOM element, media query list, window, or document to attach the event listener to
 * @param {KW | KH | KM} [eventName] - The name of the event to listen for.
 * @param {(event: WindowEventMap[KW] | HTMLElementEventMap[KH] | MediaQueryListEventMap[KM] | Event) => void} handler - The event handler function.
 * @param {boolean | AddEventListenerOptions} [options] - An options object that specifies characteristics about the event listener (optional).
 * @see [Documentation](https://usehooks-ts.com/react-hook/use-event-listener)
 * @example
 * // Example 1: Attach a window event listener
 * useEventListener(window, 'resize', handleResize);
 * @example
 * // Example 2: Attach a document event listener with options
 * const elementRef = useRef(document);
 * useEventListener(elementRef, 'click', handleClick, { capture: true });
 * @example
 * // Example 3: Attach an element event listener
 * const buttonRef = useRef<HTMLButtonElement>(null);
 * useEventListener(buttonRef, 'click', handleButtonClick);
 */
function useEventListener<
  KW extends keyof WindowEventMap,
  KH extends keyof HTMLElementEventMap,
  KM extends keyof MediaQueryListEventMap,
  T extends HTMLElement | MediaQueryList = HTMLElement
>(
  element: RefObject<Window | Document | T> | Window | Document | T | undefined,
  eventName: KW | KH | KM,
  handler: (
    event: WindowEventMap[KW] | HTMLElementEventMap[KH] | MediaQueryListEventMap[KM] | Event
  ) => void,
  options?: boolean | AddEventListenerOptions
) {
  const savedHandler = useLatestCallback(handler);

  useEffect(() => {
    // Define the listening target
    const targetElement = element && 'current' in element ? element.current : element;

    if (!targetElement || !targetElement?.addEventListener) return;

    targetElement.addEventListener(eventName, savedHandler, options);

    // Remove event listener on cleanup
    return () => {
      targetElement.removeEventListener(eventName, savedHandler, options);
    };
  }, [element, eventName, serializeOptions(options)]);
}

export default useEventListener;
