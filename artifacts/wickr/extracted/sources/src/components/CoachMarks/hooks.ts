import { useCallback, useSyncExternalStore } from 'react';
import { TourId } from '@/store/slices/coachMarks';
import { ReactExternalStore } from '@/utils/ReactExternalStore';

/**
 * Internal store that manages the mapping between coach mark identifiers and their target DOM elements.
 *
 * This store maintains a record where keys are generated IDs (combining CoachMarkId and stepOrder)
 * and values are the actual HTMLElements that serve as coach mark targets. The store is used
 * internally by useSetCoachMarkTarget and useCoachMarkTarget hooks to register and retrieve
 * target elements for coach mark positioning.
 *
 * @internal
 */
const coachMarkRefs = new ReactExternalStore<Record<string, HTMLElement | null>>({});

function toId(id: TourId, stepId: string) {
  return `${id}-${stepId}`;
}

/**
 * Returns a ref callback function that registers a DOM element as a coach mark target.
 *
 * This hook is used to register DOM elements that should be targeted by coach marks.
 * The returned callback should be assigned to the `ref` prop of the target element.
 * The registered element can later be retrieved using `useCoachMarkTarget` with the same
 * id and stepId.
 *
 * @param id - The unique identifier for the coach mark sequence
 * @param stepId - The unique identifier for this specific step
 * @returns A ref callback function that accepts an HTMLElement or null
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   // value can be accessed via useCoachMarkTarget('onboarding', 'welcome-step');
 *   const setTarget = useSetCoachMarkTarget('onboarding', 'welcome-step');
 *
 *   return (
 *     <button ref={setTarget}>
 *       Click me for the first step
 *     </button>
 *   );
 * }
 *
 * ```
 *
 * @see {@link useCoachMarkTarget}
 */
export function useSetCoachMarkTarget(id: TourId, stepId: string) {
  const mapId = toId(id, stepId);

  return useCallback(
    (el: HTMLElement | null) => {
      coachMarkRefs.setSnapshot((refs) => ({
        ...refs,
        [mapId]: el,
      }));
    },
    [mapId]
  );
}

/**
 * Retrieves a previously registered coach mark target element.
 *
 * This hook returns the DOM element that was registered using `useSetCoachMarkTarget`
 * with the same id and stepId. Returns null if no element has been registered
 * or if the element is no longer mounted. The hook value re-renders when the ref changes.
 *
 * @param id - The unique identifier for the coach mark sequence
 * @param stepId - The unique identifier for this specific step
 * @returns The registered HTMLElement or null if not found
 *
 * @example
 * ```tsx
 * function CoachMarkOverlay() {
 *   const targetElement = useCoachMarkTarget('onboarding', 'welcome-step');
 *
 *   if (!targetElement) {
 *     return null; // Target not ready yet
 *   }
 *
 *   return (
 *     <div style={{ top: targetElement.offsetTop + 10, left: targetElement.offsetLeft + 10 }>
 *       Coach mark content
 *     </div>
 *   );
 * }
 * ```
 *
 * @see {@link useSetCoachMarkTarget}
 */
export function useCoachMarkTarget(id: TourId, stepId: string) {
  const mapId = toId(id, stepId);

  const refs = useSyncExternalStore(coachMarkRefs.subscribe, coachMarkRefs.getSnapshot);

  return refs[mapId];
}
