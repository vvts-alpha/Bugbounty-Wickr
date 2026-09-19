import { createContext, useContext } from 'react';
import { TourId } from '@/store/slices/coachMarks';

export type CoachMarkStepEvent = {
  stepId: string;
  stepIndex: number;
  totalSteps: number;
};

export type CoachMarksContextType = {
  id: TourId;
  onStart: () => void;
  onStep: (event: CoachMarkStepEvent) => void;
  onEnd: () => void;
  onCancel: (event: CoachMarkStepEvent) => void;
};

export const CoachMarksContext = createContext<CoachMarksContextType | null>(null);

export function useCoachMarksContext() {
  const context = useContext(CoachMarksContext);
  if (!context) throw new Error('CoachMarksContext is null');
  return context;
}
