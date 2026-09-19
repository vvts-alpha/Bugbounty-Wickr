import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { createResetSliceReducer, resetSlice } from '../shared';
import { OverlayState, OverlayName } from './overlayModels';

const initialState: OverlayState = { overlay: null, overlayParams: null };

type OverlayWithParams = [OverlayName, any];

type OverlayPayload = OverlayName | OverlayWithParams;

export const overlaySlice = createSlice({
  name: 'overlay',
  initialState,
  reducers: {
    setOverlay: (state, { payload }: PayloadAction<OverlayPayload>) => {
      if (Array.isArray(payload)) {
        state.overlay = payload[0];
        state.overlayParams = payload[1];
      } else {
        state.overlay = payload;
        state.overlayParams = null;
      }
    },
    clearOverlay: (state) => {
      state.overlay = null;
      state.overlayParams = null;
    },
  },
  extraReducers(builder) {
    builder.addCase(resetSlice, createResetSliceReducer('overlay', initialState));
  },
});

export const overlayReducer = overlaySlice.reducer;
export const { setOverlay, clearOverlay } = overlaySlice.actions;
