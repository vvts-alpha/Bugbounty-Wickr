import { useReducer } from 'react';

type ForceUpdate<F extends AnyFunction> = F & {
  /** The number of times forceUpdate has been run, useful for useEffect dependencies */
  count: number;
};

/**
 * Force component to update
 * @returns a function that queues an update. Function has a .count property which is useful
 * if you need to respond to changes in the count.
 * @example
 * const forceUpdate = useForceUpdate();
 * useEffect(() => {
 *   if (forceUpdate.count > 0) doSomething();
 * }, [forceUpdate.count]);
 * <button onClick={forceUpdate}>Update</button>
 */
export default function useForceUpdate<F extends AnyFunction>(): ForceUpdate<F> {
  const countAndDispatch = useReducer((x) => x + 1, 0);
  const [count] = countAndDispatch;
  const forceUpdate = countAndDispatch[1] as ForceUpdate<F>;
  forceUpdate.count = count;
  return forceUpdate;
}
