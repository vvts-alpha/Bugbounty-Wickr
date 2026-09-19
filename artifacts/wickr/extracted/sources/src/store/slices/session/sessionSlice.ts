import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { createResetSliceReducer, resetSlice } from '../shared';
import { SessionState } from './sessionModels';

const initialState: SessionState = {
  sessionExpiresAt: 0,
  reauthErrorMessage: '',
  reauthIsSubmitting: false,
  showSessionTimeoutMenuItem: false,
};

export const sessionSlice = createSlice({
  name: 'session',
  initialState,
  reducers: {
    setSessionExpiresAt: (state, { payload }: PayloadAction<number>) => {
      state.sessionExpiresAt = payload;
    },
    setReauthErrorMessage: (state, { payload }: PayloadAction<string>) => {
      state.reauthErrorMessage = payload;
    },
    setReauthIsSubmitting: (state, { payload }: PayloadAction<boolean>) => {
      state.reauthIsSubmitting = payload;
    },
    setShowSessionTimeoutMenuItem: (state, { payload }: PayloadAction<boolean>) => {
      state.showSessionTimeoutMenuItem = payload;
    },
  },
  extraReducers(builder) {
    builder.addCase(resetSlice, createResetSliceReducer('session', initialState));
  },
});

export const sessionReducer = sessionSlice.reducer;
export const {
  setSessionExpiresAt,
  setReauthErrorMessage,
  setReauthIsSubmitting,
  setShowSessionTimeoutMenuItem,
} = sessionSlice.actions;
