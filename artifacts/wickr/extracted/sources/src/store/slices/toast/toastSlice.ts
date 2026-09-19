import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { createResetSliceReducer, resetSlice } from '../shared';
import { ToastItemInternal, ToastItem, ToastState } from './toastModels';

const initialState: ToastState = {
  toasts: [],
};

let nextToastId = 1;

export const toastSlice = createSlice({
  name: 'toast',
  initialState,
  reducers: {
    addToast: (state, { payload }: PayloadAction<ToastItem>) => {
      const existingToastIndex =
        payload.id === undefined ? -1 : state.toasts.findIndex(({ id }) => id === payload.id);
      const toast: ToastItemInternal = {
        ...payload,
        id: payload.id ?? nextToastId++,
        instanceId: 1,
      };
      if (existingToastIndex > -1) {
        toast.instanceId = state.toasts[existingToastIndex].instanceId + 1;
        state.toasts.splice(existingToastIndex, 1);
      }
      state.toasts.push(toast);
    },
    removeToast: (state, { payload }: PayloadAction<string | number>) => {
      state.toasts = state.toasts.filter((toast) => toast.id !== payload);
    },
  },
  extraReducers(builder) {
    builder.addCase(resetSlice, createResetSliceReducer('toast', initialState));
  },
});

export const toastReducer = toastSlice.reducer;
export const { addToast, removeToast } = toastSlice.actions;
