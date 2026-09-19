import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { createResetSliceReducer, resetSlice } from '../shared';
import { CallsState } from './callsModels';

const initialState: CallsState = {
  selfCallStatus: false,
  isCallShuttingDown: false,
};

export const callsSlice = createSlice({
  name: 'calls',
  initialState,
  reducers: {
    setSelfCallStatus: (state, action: PayloadAction<boolean>) => {
      state.selfCallStatus = action.payload;
    },
    setIsCallShuttingDown: (state, action: PayloadAction<boolean>) => {
      state.isCallShuttingDown = action.payload;
    },
  },
  extraReducers(builder) {
    builder.addCase(resetSlice, createResetSliceReducer('calls', initialState));
  },
});

export const callsReducer = callsSlice.reducer;

export const { setSelfCallStatus, setIsCallShuttingDown } = callsSlice.actions;
