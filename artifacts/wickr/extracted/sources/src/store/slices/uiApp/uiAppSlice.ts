import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { resetSlice } from '../shared';
import { UIApp, AppName } from './uiAppModels';

const initialState: UIApp = {
  appName: 'chat',
};

export const uiAppSlice = createSlice({
  name: 'uiApp',
  initialState,
  reducers: {
    setUIAppName: (state, { payload }: PayloadAction<AppName>) => {
      state.appName = payload;
    },
  },
  extraReducers(builder) {
    builder.addCase(resetSlice, () => {
      return initialState;
    });
  },
});

export const uiAppReducer = uiAppSlice.reducer;

export const { setUIAppName } = uiAppSlice.actions;
