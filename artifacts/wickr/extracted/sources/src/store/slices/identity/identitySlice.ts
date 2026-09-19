import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { createResetSliceReducer, resetSlice } from '../shared';
import { IdentityState } from './identityModels';

const initialState: IdentityState = {
  isLoggedIn: false,
};

export const identitySlice = createSlice({
  name: 'identity',
  initialState,
  reducers: {
    setIsLoggedIn: (state, { payload }: PayloadAction<boolean>) => {
      state.isLoggedIn = payload;
      if (!payload) {
        delete state.selfUserIdHash;
      }
    },
    setSelfUserIdHash: (state, { payload }: PayloadAction<string>) => {
      state.selfUserIdHash = payload;
    },
    clearSelfUserIdHash: (state) => {
      delete state.selfUserIdHash;
    },
  },
  extraReducers(builder) {
    builder.addCase(resetSlice, createResetSliceReducer('identity', initialState));
  },
});

export const identityReducer = identitySlice.reducer;
export const { setIsLoggedIn, setSelfUserIdHash, clearSelfUserIdHash } = identitySlice.actions;
