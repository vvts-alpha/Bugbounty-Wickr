import { useState } from 'react';

/** Execute the function once (on mount) and store its return value */
export default function useConst<T>(fn: () => T): T {
  const [value] = useState(fn);
  return value;
}
