import { RefObject } from 'react';
import { asNode } from '@/utils/dom';
import useEventListener from './useEventListener';

export default function useClickOutside(
  ref: RefObject<HTMLElement> | HTMLElement | null | undefined,
  onClickOutside?: (e: MouseEvent | TouchEvent) => void
) {
  const isOutside = (e: MouseEvent | TouchEvent) => {
    const el = ref instanceof Element ? ref : ref?.current;
    const target = asNode(e.target);
    if (!el || !target) return false;
    return !el.contains(target);
  };

  const handleMouseDown = (e: MouseEvent | TouchEvent) => {
    if (isOutside(e) && onClickOutside) {
      onClickOutside(e);
    }
  };

  // If ref is undefined, do not attach listeners
  const target = ref ? document : undefined;
  useEventListener(target, 'mousedown', handleMouseDown);
  useEventListener(target, 'touchstart', handleMouseDown);
}
