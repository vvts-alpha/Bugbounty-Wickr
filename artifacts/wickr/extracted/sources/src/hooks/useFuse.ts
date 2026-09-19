import Fuse from 'fuse.js';
import { useMemo } from 'react';

export default function useFuse<T>(list: T[], fuseOptions?: Fuse.IFuseOptions<T>) {
  const fuse = useMemo(() => {
    return new Fuse(list, fuseOptions);
  }, [list, fuseOptions]);

  return fuse;
}
