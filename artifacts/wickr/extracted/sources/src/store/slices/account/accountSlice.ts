import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { createResetSliceReducer, resetSlice } from '../shared';
import { AccountAttributes } from '@/apis/webChannel/BridgeWebChannel';
import { AccountState } from './accountModels';

// Account-specific settings (not user specific)
const initialState: AccountState = {
  quickResponses: [],
  selfAttributes: {
    allowNetworkInvites: false,
    isAdmin: false,
    isAwsNetwork: false,
    joinedNetworkName: '',
  },
};

export const accountSlice = createSlice({
  name: 'account',
  initialState,
  reducers: {
    setQuickResponses: (state, { payload }: PayloadAction<string[]>) => {
      state.quickResponses = payload;
    },
    setSelfAttributes: (state, { payload }: PayloadAction<AccountAttributes>) => {
      state.selfAttributes = payload;
    },
  },
  extraReducers(builder) {
    builder.addCase(resetSlice, createResetSliceReducer('account', initialState));
  },
});

export const accountReducer = accountSlice.reducer;
export const { setQuickResponses, setSelfAttributes } = accountSlice.actions;
