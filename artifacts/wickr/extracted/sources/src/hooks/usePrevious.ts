import { useEffect, useRef } from 'react';

/**
 * Track the value of data in a previous render
 * @param value the current value you want to Track
 * @param onlyTrackChanged set to true if you only want to change previous when its value changes
 * @returns the previous value, or undefined on first render
 */
const usePrevious = <T>(value: T, onlyTrackChanged?: boolean) => {
  const ref = useRef<T>();
  useEffect(() => {
    if (!onlyTrackChanged || ref.current !== value) {
      ref.current = value;
    }
  });
  return ref.current;
};

export default usePrevious;
