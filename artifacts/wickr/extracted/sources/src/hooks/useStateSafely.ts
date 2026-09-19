import { Dispatch, SetStateAction, useCallback, useState } from 'react';

import useMounted from './useMounted';

/** @deprecated No longer needed because React handles it internally */
export default function useStateSafely<T>(
  initialValue: T | (() => T)
): [T, Dispatch<SetStateAction<T>>];
export default function useStateSafely<T = undefined>(): [
  T | undefined,
  Dispatch<SetStateAction<T | undefined>>
];
export default function useStateSafely<T>(initialValue?: T) {
  const [value, setValue] = useState(initialValue);
  const isMounted = useMounted();

  const setValueSafely = useCallback((newValue: T) => {
    if (!isMounted()) return;
    setValue(newValue);
  }, []);

  return [value, setValueSafely];
}
