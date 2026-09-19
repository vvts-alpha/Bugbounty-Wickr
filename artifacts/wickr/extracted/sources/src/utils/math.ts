import rectClamp from 'rect-clamp';

type Rect = { width: number; height: number };

export function clampRect({ width, height }: Rect, max: Rect) {
  const clamped = rectClamp([0, 0, width, height], [0, 0, max.width, max.height]);
  return { width: clamped[2], height: clamped[3] };
}

/**
 * Uniquely encode two non-negative integers into a single non-negative integer
 */
export function cantorPairing(x: number, y: number) {
  return ((x + y) * (x + y + 1)) / 2 + y;
}

type Selector<T> = (item: T) => number;

export function average(arr: number[]): number;
export function average<T>(arr: T[], selector: Selector<T>): number;
export function average<T>(arr: T[], selector: Selector<T> = (item) => item as number): number {
  if (!arr?.length) return 0;

  const sum = arr.reduce((acc, item) => acc + selector(item), 0);
  return sum / arr.length;
}

/**
 * Calculate the relative change between a reference value and a new value
 * @param reference The reference value
 * @param value The new value
 * @link https://en.wikipedia.org/wiki/Relative_change#Definition
 * @returns The relative change, expressed as a fraction between -1 and 1
 */
export function relativeChange(reference: number, value: number) {
  return (value - reference) / reference;
}

let uniqueId = 0;

/**
 * Get a unique id
 */
export function getUniqueId(prefix = 'id-'): string {
  return `${prefix}${uniqueId++}`;
}

/**
 * Determines if a given point is within a given DOMRect
 * DOMRects have subpixel values, which are ignored for these computations
 * @param point The point to check
 * @param rect The DOMRect to check against
 * @returns True if the point is within the DOMRect, false otherwise
 */
export function isPointInDOMRect({ x, y }: { x: number; y: number }, rect: DOMRect): boolean {
  return (
    x >= Math.trunc(rect.left) &&
    x <= Math.trunc(rect.right) &&
    y >= Math.trunc(rect.top) &&
    y <= Math.trunc(rect.bottom)
  );
}

/**
 * Create a rolling value array
 * @param maxSize The max size of the array
 * @param initialValue The initial value of the array
 * @returns An object with an addValue function and values
 */
export function createRollingValueArray(maxSize: number, initialValue?: number[]) {
  const values: number[] = [];
  let index = 0;

  function addValue(value: number) {
    values[index] = value;
    index = (index + 1) % maxSize;
  }

  initialValue?.forEach((value) => addValue(value));

  return {
    /** Add a value to the array */
    addValue,
    /** The values in the array. They are in no particular order. */
    values,
  };
}

/**
 * Truncate a float to a given number of decimal places
 * @param float The float to truncate
 * @param decimalPlaces The number of decimal places to truncate to
 * @returns The truncated float
 */
export function truncateFloat(float: number, decimalPlaces = 2) {
  const pow = 10 ** decimalPlaces;
  return Math.trunc(float * pow) / pow;
}

/**
 * Performs a binary search on a collection using custom getter and comparator functions.
 *
 * @param length The size of the collection to search
 * @param getter Function to retrieve an item at a specific index
 * @param comparator Function to compare items, should return:
 *                  positive if target is greater than current element
 *                  negative if target is less than current element
 *                  zero if elements are equal
 * @returns The element and index if found, or insertion index if not found
 */
export function binarySearch<T>(
  length: number,
  getter: (index: number) => T,
  comparator: (element: T) => number
):
  | {
      element: T;
      index: number;
      insertionIndex?: never;
    }
  | {
      element?: never;
      index?: never;
      insertionIndex: number;
    } {
  // low represents the lower bound of the search range
  let low = 0;
  // high represents the upper bound of the search range
  let high = length - 1;

  // Continue searching while the bounds haven't crossed
  while (low <= high) {
    // Calculate the middle point
    // Using Math.floor to handle odd-length ranges
    // Note: (low + high) could overflow for large arrays
    const mid = low + Math.floor((high - low) / 2);

    // Get the element at the middle index using the provided getter function
    const element = getter(mid);

    // Compare the middle element with the target using the provided comparator
    // comparator should return:
    // - positive if target > element
    // - negative if target < element
    // - zero if target == element
    const comparison = comparator(element);

    if (comparison < 0) {
      // If comparison is negative, target is in the left half
      // Update upper bound to search lower half of range
      high = mid - 1;
    } else if (comparison > 0) {
      // If comparison is positive, target is in the right half
      // Update lower bound to search upper half of range
      low = mid + 1;
    } else {
      // If comparison is zero, exact match found
      // Return the element and index where the element was found
      return { element, index: mid };
    }
  }

  // If no match was found, return the insertion point
  // The insertion point is where the element should be inserted
  // to maintain sorted order
  return { insertionIndex: low };
}
