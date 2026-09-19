import { Logger } from '@/lib/logger';

const logger = new Logger('dom');

// DOM is not available in all contexts (e.g., workers)
const HAS_NODE = typeof Node === 'function';
const HAS_ELEMENT = typeof Element === 'function';
const HAS_HTML = typeof HTMLElement === 'function';
const HAS_DOMPARSER = typeof DOMParser === 'function';

// https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement
// Inheritence hierarchy:
// [ EventTarget ]<--[ Node ]<--[ Element ]<--[ HTMLElement ]

/** @returns true if node is a Node */
export function isNode(node: unknown): node is Node {
  return HAS_NODE && node instanceof Node;
}

/** @returns node if node is a Node */
export function asNode(node: unknown): Node | undefined {
  return isNode(node) ? node : undefined;
}
/** @returns true if element is an Element, e.g., HTMLElement SVGElement */
export function isElement(element: unknown): element is Element {
  return HAS_ELEMENT && element instanceof Element;
}

/** @returns element if element is an Element, e.g., HTMLElement SVGElement */
export function asElement(element: unknown): Element | undefined {
  return isElement(element) ? element : undefined;
}

/** @returns true if element is an HTMLElement */
export function isHtmlElement(element: unknown): element is HTMLElement {
  return HAS_HTML && element instanceof HTMLElement;
}

/** @returns element if element is an HTMLElement */
export function asHtmlElement(element: unknown): HTMLElement | undefined {
  return isHtmlElement(element) ? element : undefined;
}

/** This operation is expensive. Use sparingly. */
export const getRootStyles = (...args: string[]) => {
  const stylesMap: any = {};
  if (HAS_ELEMENT && typeof getComputedStyle === 'function') {
    const rootStyles = getComputedStyle(document.documentElement);

    for (let i = 0; i < args.length; i++) {
      const cssVarValue =
        rootStyles && !!rootStyles.getPropertyValue && rootStyles.getPropertyValue(args[i]);

      stylesMap[args[i]] = cssVarValue;
    }
  }

  return stylesMap;
};

export const FOCUSABLE_ELEMENTS_SELECTOR =
  'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])';

// Prefer text-based inputs -- those without a type are text, selected by: input:not([type])
const PREFERRED_FOCUSABLE_ELEMENTS_SELECTOR = [
  'email',
  'number',
  'password',
  'search',
  'tel',
  'text',
  'url',
]
  .map((type) => `input[type=${type}]`)
  .concat('input:not([type])')
  .join(', ');

/** Find all focusable elements in one or more elements */
export const getFocusableElements = (elements: Element | (Element | null)[]): HTMLElement[] => {
  if (!Array.isArray(elements)) {
    elements = [elements];
  }
  elements = elements.filter(isElement);

  const nodeList: HTMLElement[] = [];
  elements.forEach((el) => {
    if (isHtmlElement(el)) {
      const subList = [...el.querySelectorAll(FOCUSABLE_ELEMENTS_SELECTOR)] as HTMLElement[];
      nodeList.push(...subList);
    }
  });
  return nodeList;
};

/** Focuses the first text input, or the first focusable element. Used when opening modals or panels. */
export const focusPreferredElement = (container: Element | null) => {
  if (!container) return;
  const el: HTMLElement =
    (container.querySelector(PREFERRED_FOCUSABLE_ELEMENTS_SELECTOR) as HTMLElement) ||
    getFocusableElements(container)[0];
  el?.focus();
  return el;
};

export function isLastFocusableElement(
  element: Element | EventTarget | null,
  containerElement: Element | EventTarget | null
) {
  if (!isElement(element) || !isElement(containerElement)) return false;
  const all = getFocusableElements(containerElement);
  return all.length > 0 && all[all.length - 1] === element;
}

export function isFirstFocusableElement(
  element: Element | EventTarget | null,
  containerElement: Element | EventTarget | null
) {
  if (!isElement(element) || !isElement(containerElement)) return false;
  const all = getFocusableElements(containerElement);
  return all.length > 0 && all[0] === element;
}

export function getScrollParent(node: Element | Node | null): Node | null {
  if (!isElement(node)) {
    return null;
  }

  try {
    const overflowYStyle = getComputedStyle(node).overflowY;

    if (
      node.scrollHeight >= node.clientHeight &&
      overflowYStyle !== 'visible' &&
      overflowYStyle !== 'hidden'
    ) {
      return node;
    } else {
      return getScrollParent(node.parentNode);
    }
  } catch (err) {
    return null;
  }
}

export const getNthParent = (element: Element | null, n: number): Element | null => {
  let nthParent = element;
  for (let i = 0; i < n; i++) {
    if (!isElement(nthParent)) return null;
    nthParent = nthParent?.parentElement;
  }
  return nthParent;
};

export function setScrollTop(
  element: unknown,
  topPixels: number,
  isRelative?: boolean,
  description?: any
): boolean {
  if (__DEV__) {
    logger.info('setScrollTop', element, {
      topPixels,
      isRelative,
      description,
    });
  }
  if (!isElement(element)) return false;
  if (isRelative) {
    element.scrollTop += topPixels;
  } else {
    element.scrollTop = topPixels;
  }
  return true;
}

export function scrollToBottom(element: unknown, description?: any): boolean {
  if (__DEV__) logger.info('scrollToBottom', element, description);
  if (!isElement(element)) return false;
  element.scrollTop = element.scrollHeight;
  return true;
}

export function isScrolledToBottom(element: unknown, description?: any): boolean | undefined {
  if (!isElement(element)) return;
  const isAtBottom = element.scrollHeight - element.clientHeight - element.scrollTop < 1;
  if (__DEV__) logger.info('isScrolledToBottom', element, isAtBottom, description);
  return isAtBottom;
}

export function setScrollLeft(
  element: unknown,
  leftPixels: number,
  isRelative?: boolean,
  description?: any
): boolean {
  if (__DEV__) {
    logger.info('setScrollLeft', element, {
      leftPixels,
      isRelative,
      description,
    });
  }
  if (!isElement(element)) return false;
  if (isRelative) {
    element.scrollLeft += leftPixels;
  } else {
    element.scrollLeft = leftPixels;
  }
  return true;
}

export function scrollIntoView(element: unknown, arg?: boolean | ScrollIntoViewOptions): boolean {
  if (__DEV__) logger.info('scrollIntoView', element, arg);
  if (!isElement(element)) return false;
  element.scrollIntoView(arg);
  return true;
}

const RAF_TIMEOUT = 200;

/**
 * Calls requestAnimationFrame with fallback to setTimeout if raf is not called
 * in a timely fashion, such as when the page is backgronded and raf isn't run
 */
export function adaptiveRequestAnimationFrame(
  callback: FrameRequestCallback,
  timeout = RAF_TIMEOUT
) {
  // wrap the callback so we can control how many times callback is called
  const callbackOnce = (time: number) => {
    stop();
    callback(time);
  };

  const stop = () => {
    cancelAnimationFrame(rafHandle);
    clearTimeout(timeoutHandle);
  };
  // eslint-disable-next-line no-restricted-syntax
  const rafHandle = requestAnimationFrame(callbackOnce);

  // fallback to timeout if raf doesn't run on time
  const timeoutHandle = setTimeout(() => callbackOnce(performance.now()), timeout);

  return stop;
}

/**
 * Used if we want a frame is definitely painted before attempting to do something
 * Read more: https://bugs.chromium.org/p/chromium/issues/detail?id=675795
 */
export function doubleRequestAnimationFrame(
  callback: FrameRequestCallback,
  timeoutPerRaf = RAF_TIMEOUT
) {
  let cancel = adaptiveRequestAnimationFrame(() => {
    cancel = adaptiveRequestAnimationFrame(callback, timeoutPerRaf);
  }, timeoutPerRaf);
  return () => cancel();
}

const framePaintCallbacks: (() => void)[] = [];
let messageChannel: MessageChannel | undefined;

/**
 * Runs `callback` shortly after the next browser Frame is produced.
 *
 * Source: https://webperf.tips/tip/measuring-paint-time/#detecting-when-paint-occurs
 */
export function runAfterFramePaint(callback: () => void) {
  if (!messageChannel) {
    messageChannel = new MessageChannel();
    // Setup the callback to run in a Task
    messageChannel.port1.onmessage = () => {
      framePaintCallbacks.forEach((callback) => callback());
      framePaintCallbacks.length = 0;
    };
  }
  // Queue a "before Render Steps" callback via requestAnimationFrame.
  adaptiveRequestAnimationFrame(() => {
    if (!framePaintCallbacks.length) {
      // Queue the Task on the Task Queue
      messageChannel!.port2.postMessage(undefined);
    }
    // Queue the callback to run in a Task
    framePaintCallbacks.push(callback);
  }, 0);
}

/**
 * Copy image to clipboard
 * @returns true if successful, false otherwise
 */
export async function copyImage(
  img: HTMLImageElement,
  width?: number,
  height?: number
): Promise<boolean> {
  if (!HAS_ELEMENT) return false;
  try {
    const canvas = document.createElement('canvas');
    canvas.width = width ?? img.naturalWidth;
    canvas.height = height ?? img.naturalHeight;
    canvas.getContext('2d')?.drawImage(img, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((blob) => {
        canvas.remove();
        resolve(blob);
        if (!blob) {
          return;
        }
      });
    });

    if (!blob) return false;

    // TODO: ClipboardItem isn't supported in FF, so check on this again when we go full web
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);

    // write rejects on failure, so return true if we get this far
    // https://developer.mozilla.org/en-US/docs/Web/API/Clipboard/write#return_value
    return true;
  } catch (err) {
    logger.error('copyImage failed:', err);
    return false;
  }
}

export const isElementInPopOver = (node: unknown) => {
  if (
    isHtmlElement(node) &&
    (node.closest('.popoverMenu') ||
      node.closest('.popoverContentWrapper') ||
      node.closest(`[data-blur-editor='true']`))
  ) {
    return true;
  }
  return false;
};

/** Given an input string, sanitizes any HTML out of it using a DOMParser. */
export const sanitizeHTML = (input: string): string => {
  if (!HAS_DOMPARSER) {
    logger.warn(
      `sanitizeHTML used in an environment without DOMParser - input will not be sanitized`
    );
    return input;
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(input, 'text/html');
  return doc.body.textContent ?? '';
};
