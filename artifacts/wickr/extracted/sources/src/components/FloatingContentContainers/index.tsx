import { doubleRequestAnimationFrame } from '@/utils/dom';
import styles from './styles.module.less';

// Use IDs so that these can be found across different windows/documents
const FLOATING_CONTAINER_ID = 'Floating__container';
const POPOVER_CONTAINER_ID = 'PopOver__container';
const TOOLTIP_CONTAINER_ID = 'Tooltip__container';

type FloatingContentState = {
  /** Get the PopOver container for a given document */
  getPopOverContainer(doc: Document | undefined): HTMLElement | null;
  /** Get the Tooltip container for a given document */
  getTooltipContainer(doc: Document | undefined): HTMLElement | null;
  /**
   * Notify the containers when they are updated so their logic can run.
   * This must be done outside of the React lifecyle to support external
   * windows.
   */
  didUpdateFloatingContent(doc: Document | undefined): void;
};

const floatingContentUtils: FloatingContentState = {
  getPopOverContainer: (doc = document) => doc.getElementById(POPOVER_CONTAINER_ID),
  getTooltipContainer: (doc = document) => doc.getElementById(TOOLTIP_CONTAINER_ID),
  didUpdateFloatingContent: (doc = document) => {
    // wrap in raf so it will wait for the rendering to settle
    doubleRequestAnimationFrame(() => {
      const floatingContainer = doc.getElementById(FLOATING_CONTAINER_ID);
      const popOverContainer = doc.getElementById(POPOVER_CONTAINER_ID);
      if (!floatingContainer || !popOverContainer) return;

      // If there are PopOvers we want to hide Tooltips to prevent the PopOver from being
      // obscured by the Tooltip because it can block PopOver mouse events. This means
      // that any PopOver content with tooltips will never show the tips.
      if (popOverContainer.childElementCount > 0) {
        floatingContainer.classList.add(styles.hasPopOver);
      } else {
        floatingContainer.classList.remove(styles.hasPopOver);
      }
    }, 60);
  },
};

export function useFloatingContent() {
  return floatingContentUtils;
}

export const FloatingContentContainers: React.FC = () => {
  return (
    <div
      id={FLOATING_CONTAINER_ID}
      className={styles.floatingContainer}
      data-testid="floating-container"
    >
      <div
        id={POPOVER_CONTAINER_ID}
        className={styles.popOverContainer}
        data-testid="popover-container"
      ></div>
      <div
        id={TOOLTIP_CONTAINER_ID}
        className={styles.tooltipContainer}
        data-testid="tooltip-container"
      ></div>
    </div>
  );
};
