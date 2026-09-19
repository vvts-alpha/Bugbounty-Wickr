import { ForwardedRef, MutableRefObject, useImperativeHandle, useRef } from 'react';

/**
 * @returns a ref that can be used locally and properly assigns the forwardRef
 *
 * forwardRef refs can be functions, ref.current, or null. If we need to use the ref within the component
 * beyond assignment, we need a safe way to 1/ assign the ref and 2/ access it locally.
 * This hook behaves the same as refs in that assigning them does not force a re-render.
 */
export default function useForwardedRef<T>(forwardedRef?: ForwardedRef<T>): MutableRefObject<T> {
  // internal ref that the "local" component can use
  const localRef = useRef<T>();

  // @ts-expect-error
  useImperativeHandle(forwardedRef, () => localRef.current);

  return localRef as MutableRefObject<T>;
}
