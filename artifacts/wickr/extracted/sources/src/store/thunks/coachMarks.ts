import {
  selectTours,
  setActiveTourId,
  clearActiveTourId,
  TourId,
  selectIsTourCompleted,
  resetTourProgress,
  nextCoachMark,
  previousCoachMark,
  upsertTourState,
} from '../slices/coachMarks';
import { createAppAsyncThunk } from '../utils';

export const hydrateTourState = createAppAsyncThunk(
  'coachMarks/hydrateTourState',
  async (_: never, { dispatch, extra }) => {
    const toursFromStorage = await extra.storage.get('Tours', []);
    toursFromStorage.forEach((tourState) => {
      dispatch(upsertTourState(tourState));
    });
  }
);

export const syncTourState = createAppAsyncThunk(
  'coachMarks/syncTourState',
  async (_: never, { extra, getState }) => {
    const tours = selectTours(getState());

    const toursForStorage = Object.values(tours);

    await extra.storage.set('Tours', toursForStorage);
  }
);

/** Reset progress and start tour */
export const startTour = createAppAsyncThunk(
  'coachMarks/startTour',
  async (id: TourId, { dispatch }) => {
    dispatch(resetTourProgress(id));
    dispatch(setActiveTourId(id));
    dispatch(syncTourState());
  }
);

/** Resume tour if it is not completed */
export const resumeTour = createAppAsyncThunk(
  'coachMarks/resumeTour',
  async (id: TourId, { dispatch, getState }) => {
    const isCompleted = selectIsTourCompleted(getState(), id);

    if (!isCompleted) {
      dispatch(setActiveTourId(id));
    }
  }
);

export const nextTourStep = createAppAsyncThunk(
  'coachMarks/nextTourStep',
  async (_: never, { dispatch }) => {
    dispatch(nextCoachMark());
    dispatch(syncTourState());
  }
);

export const previousTourStep = createAppAsyncThunk(
  'coachMarks/previousTourStep',
  async (_: never, { dispatch }) => {
    dispatch(previousCoachMark());
    dispatch(syncTourState());
  }
);

export const markTourComplete = createAppAsyncThunk(
  'coachMarks/markTourComplete',
  async (id: TourId, { dispatch }) => {
    dispatch(upsertTourState({ id, completed: true }));
    dispatch(clearActiveTourId(id));
    dispatch(syncTourState());
  }
);

/** Clear completed and stepIndex for all tours */
export const clearAllTourProgress = createAppAsyncThunk(
  'coachMarks/clearAllTourProgress',
  async (_: never, { dispatch, getState }) => {
    const tours = selectTours(getState());

    Object.keys(tours).forEach((id) => {
      dispatch(resetTourProgress(id as TourId));
    });

    dispatch(syncTourState());
  }
);
