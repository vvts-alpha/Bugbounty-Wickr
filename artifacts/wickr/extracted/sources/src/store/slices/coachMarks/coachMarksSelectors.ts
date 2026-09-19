import { AppRootState } from '@/store/models';
import { TourId } from './coachMarksModels';

export const selectActiveTourId = (state: AppRootState) => state.coachMarks.activeTourId;

export const selectTours = (state: AppRootState) => state.coachMarks.tours;

export const selectTourStepIndex = (state: AppRootState, id: TourId) =>
  state.coachMarks.tours[id]?.stepIndex ?? 0;

export const selectIsTourCompleted = (state: AppRootState, id: TourId) =>
  state.coachMarks.tours[id]?.completed ?? false;
