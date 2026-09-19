import { useState, useEffect } from 'react';

const QUERY = '(prefers-reduced-motion: no-preference)';
const getInitialState = () => !window.matchMedia(QUERY).matches;

/**
 * Hook to get the current value of "prefers-reduced-motion". In QT, this value will
 * only update once the app is restarted.
 *
 * source: https://www.joshwcomeau.com/react/prefers-reduced-motion/#the-hook-5
 * @returns True if the user prefers reduced motion, false if not or if not supported.
 */
export function usePrefersReducedMotion() {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(getInitialState);

  useEffect(() => {
    const mediaQueryList = window.matchMedia(QUERY);

    const listener = (event: MediaQueryListEvent) => {
      setPrefersReducedMotion(!event.matches);
    };

    mediaQueryList.addEventListener('change', listener);

    return () => {
      mediaQueryList.removeEventListener('change', listener);
    };
  }, []);

  return prefersReducedMotion;
}
