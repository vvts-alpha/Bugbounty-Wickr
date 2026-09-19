import { clsx } from 'clsx';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { usePopper } from 'react-popper';
import { Button } from '@/componentlibrary';
import { Placement } from '@/componentlibrary/PopOver/PopOver';
import { KEY_CODES } from '@/componentlibrary/constants';
import trapFocus from '@/componentlibrary/utils/trap-focus';
import { useFloatingContent } from '@/components/FloatingContentContainers';
import useClickOutside from '@/hooks/useClickOutside';
import useEventListener from '@/hooks/useEventListener';
import { useAppTranslation } from '@/lib/i18n';
import { useAppDispatch } from '@/store';
import { clearActiveTourId, TourId } from '@/store/slices/coachMarks';
import { nextTourStep, previousTourStep, markTourComplete } from '@/store/thunks/coachMarks';
import { valueOrInitializer } from '@/utils/function';
import { CoachMarkMarker } from './CoachMarkMarker';
import { useCoachMarksContext } from './CoachMarksContext';
import { useCoachMarkTarget } from './hooks';

import styles from './CoachMarks.module.less';

export type MarkerOffset = [number, number] | ((rect: DOMRect) => [number, number]);

export interface CoachMarkStep {
  /** Unique identifier for this step, used for target element lookup. */
  stepId: string;
  /** Header text */
  title: string;
  /** Description content */
  description: React.ReactNode;
  /** Popper placement */
  placement?: Placement;
  /** Popper offset */
  offset?: [number, number];
  /** Theme for the marker dot */
  markerTheme?: 'light-theme' | 'dark-theme';
  /** Marker offset from the target */
  markerOffset?: MarkerOffset;
}

interface CoachMarkProps extends CoachMarkStep {
  tourId: TourId;
  stepIndex: number;
  totalSteps: number;
}

interface CoachMarkContentProps extends CoachMarkProps {
  targetElement: HTMLElement;
  containerElement: HTMLElement;
}

// This component is not strictly necessary, but it is easier to deal with the logic
// and hooks once you can assume targetElement and containerElement and defined.
const CoachMarkContent: React.FC<CoachMarkContentProps> = ({
  tourId,
  stepId,
  stepIndex,
  totalSteps,
  offset = [5, 5],
  title,
  description,
  placement,
  markerTheme,
  markerOffset = [0, 0],
  targetElement,
  containerElement,
}) => {
  const { t } = useAppTranslation();
  const dispatch = useAppDispatch();

  const { onEnd, onCancel } = useCoachMarksContext();

  const [coachMarkEl, setCoachMarkEl] = useState<HTMLElement | null>(null);
  const { styles: popperStyles, attributes } = usePopper(targetElement, coachMarkEl, {
    placement,
    modifiers: [{ name: 'offset', options: { offset } }],
  });

  const isFirst = stepIndex === 0;
  const isLast = stepIndex + 1 === totalSteps;
  const stepNumber = stepIndex + 1;

  const handleNext = () => {
    dispatch(nextTourStep());
  };

  const handlePrevious = () => {
    dispatch(previousTourStep());
  };

  const handleStop = () => {
    if (isLast) {
      dispatch(markTourComplete(tourId));
      onEnd();
    } else {
      dispatch(clearActiveTourId(tourId));
      onCancel({ stepIndex, totalSteps, stepId });
    }
  };

  useEventListener(document, 'keydown', (e) => {
    if (e.key === KEY_CODES.ESCAPE) {
      handleStop();
    } else if (coachMarkEl) {
      trapFocus(e, coachMarkEl);
    }
  });

  useClickOutside(coachMarkEl, handleStop);

  const markerRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const markerEl = markerRef.current;

    // We don't know if the element changes position, so read its rect on every render
    if (markerEl) {
      const rect = targetElement.getBoundingClientRect();
      const computedOffset = valueOrInitializer(markerOffset, rect);
      markerEl.style.left = `${rect.x + computedOffset[0]}px`;
      markerEl.style.top = `${rect.y + computedOffset[1]}px`;
    }
  });

  const hasMultipleSteps = totalSteps > 1;

  return createPortal(
    <>
      <div
        ref={setCoachMarkEl}
        role="dialog"
        aria-labelledby="coach-mark-title"
        aria-describedby="coach-mark-description"
        className={clsx(styles.coachMark, 'popoverMenu')}
        style={popperStyles.popper}
        {...attributes.popper}
      >
        <div className={styles.header}>
          <h3 id="coach-mark-title" className={styles.title}>
            {title}
          </h3>
          <span className={styles.progress}>
            {hasMultipleSteps && `${stepNumber} / ${totalSteps}`}
          </span>
        </div>

        <div id="coach-mark-description" className={styles.description}>
          {description}
        </div>

        <div className={styles.actions}>
          <div>
            {!isLast && (
              <Button color="secondary" compact onClick={handleStop}>
                {t('Close')}
              </Button>
            )}
          </div>

          <div>
            {!isFirst && (
              <Button color="secondary" compact onClick={handlePrevious}>
                {t('Previous')}
              </Button>
            )}

            {isLast ? (
              <Button color="primary" compact onClick={handleStop} autoFocus>
                {hasMultipleSteps ? t('Done') : t('OK')}
              </Button>
            ) : (
              <Button color="primary" compact onClick={handleNext} autoFocus>
                {t('Next')}
              </Button>
            )}
          </div>
        </div>
      </div>
      <CoachMarkMarker ref={markerRef} theme={markerTheme} />
    </>,
    containerElement
  );
};

export const CoachMark: React.FC<CoachMarkProps> = (props) => {
  const { tourId, stepId } = props;

  const { didUpdateFloatingContent, getPopOverContainer } = useFloatingContent();

  const targetElement = useCoachMarkTarget(tourId, stepId);

  useEffect(() => {
    if (targetElement) {
      didUpdateFloatingContent(targetElement.ownerDocument);
      return () => didUpdateFloatingContent(targetElement.ownerDocument);
    }
  }, [targetElement, didUpdateFloatingContent]);

  if (!targetElement) {
    return null;
  }

  const containerElement = getPopOverContainer(targetElement.ownerDocument);

  if (!containerElement) {
    return null;
  }

  return (
    <CoachMarkContent
      {...props}
      targetElement={targetElement}
      containerElement={containerElement}
    />
  );
};
