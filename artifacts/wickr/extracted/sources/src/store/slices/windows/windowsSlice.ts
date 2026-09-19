import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { resetSlice } from '../shared';
import { WindowsState } from './windowsModels';

const initialState: WindowsState = {
  isChatWindowFocused: false,
};

export const windowsSlice = createSlice({
  name: 'windows',
  initialState,
  reducers: {
    setChatWindowFocused: (state, { payload }: PayloadAction<boolean>) => {
      state.isChatWindowFocused = payload;
    },
  },
  extraReducers(builder) {
    builder.addCase(resetSlice, (state) => {
      // Preserve window state for now
      return state;
    });
  },
});

export const windowsReducer = windowsSlice.reducer;
export const { setChatWindowFocused } = windowsSlice.actions;
