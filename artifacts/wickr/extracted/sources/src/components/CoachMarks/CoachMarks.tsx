import { useEffect, useMemo } from 'react';
import useLatestCallback from '@/hooks/useLatestCallback';
import { useAppDispatch, useAppSelector, useAppSelectorExtra } from '@/store';
import {
  selectActiveTourId,
  selectTourStepIndex,
  TourId,
  upsertTourState,
} from '@/store/slices/coachMarks';
import { CoachMark, CoachMarkStep } from './CoachMark';
import { CoachMarkStepEvent, CoachMarksContext, CoachMarksContextType } from './CoachMarksContext';

export type CoachMarksProps = {
  id: TourId;
  steps: CoachMarkStep[];
  onStart?: () => void;
  onStep?: (event: CoachMarkStepEvent) => void;
  onEnd?: () => void;
  onCancel?: (event: CoachMarkStepEvent) => void;
};

export const CoachMarks: ReactFC<CoachMarksProps> = (props) => {
  const activeTourId = useAppSelector(selectActiveTourId);

  return activeTourId === props.id ? <ActiveCoachMarks {...props} /> : null;
};

const noop = () => {};

const ActiveCoachMarks: ReactFC<CoachMarksProps> = ({
  steps,
  id,
  onStart = noop,
  onStep = noop,
  onEnd = noop,
  onCancel = noop,
}) => {
  const dispatch = useAppDispatch();

  const handleStart = useLatestCallback(onStart);
  const handleStep = useLatestCallback(onStep);
  const handleEnd = useLatestCallback(onEnd);
  const handleCancel = useLatestCallback(onCancel);

  const contextValue = useMemo(
    (): CoachMarksContextType => ({
      id,
      onStart: handleStart,
      onStep: handleStep,
      onEnd: handleEnd,
      onCancel: handleCancel,
    }),
    [id, handleStart, handleStep, handleEnd, handleCancel]
  );

  const stepIndex = useAppSelectorExtra(selectTourStepIndex, id);
  const totalSteps = steps.length;
  const stepProps: CoachMarkStep | undefined = steps[stepIndex];
  const stepId = stepProps?.stepId;
  const hasStep = Boolean(stepProps);

  useEffect(() => {
    dispatch(upsertTourState({ id, totalSteps }));
  }, [id, totalSteps, dispatch]);

  useEffect(() => {
    handleStart();
  }, [handleStart]);

  useEffect(() => {
    if (stepId) {
      handleStep({ stepIndex, stepId, totalSteps });
    }
  }, [handleStep, stepIndex, stepId, totalSteps]);

  return (
    <CoachMarksContext.Provider value={contextValue}>
      {hasStep && (
        <CoachMark
          key={stepProps.stepId}
          {...stepProps}
          tourId={id}
          stepIndex={stepIndex}
          totalSteps={totalSteps}
        />
      )}
    </CoachMarksContext.Provider>
  );
};
