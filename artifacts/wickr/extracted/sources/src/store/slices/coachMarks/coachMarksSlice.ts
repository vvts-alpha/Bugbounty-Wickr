import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { createResetSliceReducer, resetSlice } from '../shared';
import { TourId, CoachMarksState, TourState } from './coachMarksModels';

const initialState: CoachMarksState = {
  activeTourId: undefined,
  tours: {},
};

const getOrCreateTourState = (state: CoachMarksState, id: TourId): TourState | undefined => {
  if (!id) return;

  state.tours[id] ??= {
    id,
    completed: false,
    stepIndex: 0,
    totalSteps: 0,
  };

  return state.tours[id];
};

export const coachMarksSlice = createSlice({
  name: 'coachMarks',
  initialState,
  reducers: {
    setActiveTourId: (state, action: PayloadAction<TourId>) => {
      const id = action.payload;
      if (getOrCreateTourState(state, id)) {
        state.activeTourId = id;
      }
    },

    clearActiveTourId: (state, action: PayloadAction<TourId | undefined>) => {
      const id = action.payload;
      if (!id || id === state.activeTourId) {
        state.activeTourId = undefined;
      }
    },

    nextCoachMark: (state) => {
      if (!state.activeTourId) return;

      const tourState = state.tours[state.activeTourId];
      if (!tourState) return;

      const { totalSteps } = tourState;
      const nextStepIndex = tourState.stepIndex + 1;

      if (nextStepIndex < totalSteps) {
        tourState.stepIndex = nextStepIndex;
      } else {
        // End of tour, stop coach mark
        state.activeTourId = undefined;
        tourState.completed = true;
        tourState.stepIndex = 0;
      }
    },

    previousCoachMark: (state) => {
      if (!state.activeTourId) return;

      const tourState = state.tours[state.activeTourId];
      if (!tourState) return;

      const prevStepIndex = tourState.stepIndex - 1;
      if (prevStepIndex >= 0) {
        tourState.stepIndex = prevStepIndex;
      }
    },

    upsertTourState: (
      state,
      action: PayloadAction<Pick<TourState, 'id'> & Partial<Omit<TourState, 'id'>>>
    ) => {
      const { id, ...updatedState } = action.payload;
      const tourState = getOrCreateTourState(state, id);

      if (tourState) {
        for (const prop in updatedState) {
          const updatedValue = (updatedState as any)[prop];
          if (updatedValue !== undefined) {
            (tourState as any)[prop] = updatedValue;
          }
        }
      }
    },

    resetTourProgress: (state, { payload }: PayloadAction<TourId>) => {
      const tourState = getOrCreateTourState(state, payload);
      if (tourState) {
        tourState.completed = false;
        tourState.stepIndex = 0;
      }
    },

    clearCoachMarksState: () => initialState,
  },
  extraReducers(builder) {
    builder.addCase(resetSlice, createResetSliceReducer('coachMarks', initialState));
  },
});

export const {
  setActiveTourId,
  clearActiveTourId,
  nextCoachMark,
  previousCoachMark,
  upsertTourState,
  resetTourProgress,
  clearCoachMarksState,
} = coachMarksSlice.actions;
