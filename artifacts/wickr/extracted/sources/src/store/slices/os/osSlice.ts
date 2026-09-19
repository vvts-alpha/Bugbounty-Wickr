import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { createResetSliceReducer, resetSlice } from '../shared';
import { OSState } from './osModels';

const initialState: OSState = {
  isOSSleep: false,
};

export const osSlice = createSlice({
  name: 'os',
  initialState,
  reducers: {
    setIsOSSleep: (state, { payload }: PayloadAction<boolean>) => {
      state.isOSSleep = payload;
    },
  },
  extraReducers(builder) {
    builder.addCase(resetSlice, createResetSliceReducer('os', initialState));
  },
});

export const osReducer = osSlice.reducer;
export const { setIsOSSleep } = osSlice.actions;
