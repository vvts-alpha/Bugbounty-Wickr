import { createIntersectionObserverHooks } from '.';

export const {
  useIntersectionObserve: useMarkerIntersectionObserve,
  useIntersectionCallback: useMarkerIntersectionCallback,
} = createIntersectionObserverHooks<'leading' | 'trailing' | 'bottom'>();
