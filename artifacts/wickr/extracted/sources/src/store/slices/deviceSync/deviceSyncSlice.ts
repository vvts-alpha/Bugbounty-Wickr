import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { createResetSliceReducer, resetSlice } from '../shared';
import { DeviceSyncState } from './deviceSyncModels';

// state transition diagram: https://plantuml.corp.amazon.com/plantuml/form/encoded.html#encoded=ZLHDSzCm4BtxL-oK0t18BjmydT0EBJCSE2IXN823B6riKNbbz96E_psIB14rQMUuoRllxTjFtrZ7ZFEZQfhmSWXMzlI5W5cukfC2PktXjxSksLUIFbx16oNxmVK6aGg7CzgQnDc79sntmBN00ksKnun4ScW-1Ly2tyUl18MHaMTApO7JQoKot1Fh57v78mzpOZma0pWDnsGi4fQfKPTqX4PBxYjpV4Yaf9UCRrqG2kP_D6Hr7NvIcWb9_Q9LljRhTI5CaXvBAUFabgJkq-kT9EaaKv3SxmDZKdxCuCv8qIDSN_D1IuwRJKCwc4sC2Mrsh-4purB9oB3manQgCuniYAp9GZS7C-CkfyZIL8BauBkcoHgh7zM0VgqsET4s199zZ-OEZo63Mo5s-CUZTStYlw3bHNYTbm656AUSUCiojC2coUWZLhZOa3eZWJGt6L_2n0v7JAwcXSdROT7Uxk9sdTTP2AVXjM07_RHmzZFnODlpDEOJvZoRAesuVyyoi4yoxCmt7VUeKY-uqquNA8eCFhd-exnN61TzxHX_V06td43gH7qrBNm0ILmRWzm1SowMQr_Yvrk84UeBQk71XYkr67PIoCC1JU2cexNDCwMLdywRMiUvw7XpWoJ2d-Sl
// initial state is empty state, we get out of it via bridge signals
const initialState: DeviceSyncState = {
  currentView: 'Empty',
  newDeviceKey: '',
  deviceSyncVerifyKey: '',
};

export const deviceSyncSlice = createSlice({
  name: 'deviceSync',
  initialState,
  reducers: {
    // these are all actions which can change the visible state
    // they correspond to arrows leading to any state except Bridge in the diagram
    triggerDeviceAddRequest: (state, { payload }: PayloadAction<string>) => {
      if (state.currentView === 'Empty') {
        state.newDeviceKey = payload;
        state.currentView = 'DidYouJustSignIn';
      }
    },
    signInApproved: (state) => {
      if (state.currentView === 'DidYouJustSignIn') {
        state.currentView = 'ScanQRCode';
      }
    },
    closeEnterCodeManually: (state) => {
      if (state.currentView === 'EnterCodeManually') {
        state.currentView = 'ScanQRCode';
      }
    },
    showDeviceSyncingScreen: (state, { payload }: PayloadAction<boolean>) => {
      if (
        payload &&
        (state.currentView === 'ScanQRCode' || state.currentView === 'EnterCodeManually')
      ) {
        state.currentView = 'Uploading';
      } else if (state.currentView === 'Uploading' && !payload) {
        state.currentView = 'Empty';
      }
    },
    switchedToCode: (state, { payload }: PayloadAction<string>) => {
      if (state.currentView === 'ScanQRCode') {
        state.deviceSyncVerifyKey = payload;
        state.currentView = 'EnterCodeManually';
      }
    },
    codeDoesntMatch: (state) => {
      if (state.currentView === 'EnterCodeManually') {
        state.currentView = 'CodeDoesntMatch';
      }
    },
    unableToVerifyCode: (state) => {
      if (state.currentView === 'EnterCodeManually') {
        state.currentView = 'UnableToVerifyCode';
      }
    },
  },
  extraReducers(builder) {
    builder.addCase(resetSlice, createResetSliceReducer('deviceSync', initialState));
  },
});

export const deviceSyncReducer = deviceSyncSlice.reducer;
export const deviceSyncActions = deviceSyncSlice.actions;
