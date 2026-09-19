import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { createResetSliceReducer, resetSlice } from '../shared';
import { SdkErrorInfo, isCannotAddUserError } from '@/utils/sdkErrors';
import { ModalName, ModalState, ModalParamsPayload, ModalNameParamsMap } from './modalModels';

const initialState: ModalState = { stack: [] };

export const modalSlice = createSlice({
  name: 'modal',
  initialState,
  reducers: {
    pushModal: (state, { payload }: PayloadAction<ModalParamsPayload<any>>) => {
      if (typeof payload === 'string') {
        const alreadyAdded = !!state.stack.find((modal) => modal.name === payload);
        if (alreadyAdded) return;
        state.stack.push({ name: payload });
      } else {
        const alreadyAdded = !!state.stack.find((modal) => modal.name === payload.name);
        if (alreadyAdded) return;
        state.stack.push({ name: payload.name, params: payload.params });
      }
    },
    // Do not export; prefer closeModal thunk
    clearModal: (state, { payload }: PayloadAction<ModalName>) => {
      state.stack = state.stack.filter((modal) => modal.name !== payload);
    },
    clearAllModals: (state) => {
      state.stack = [];
    },
    enqueueSdkError: (state, { payload }: PayloadAction<SdkErrorInfo>) => {
      // Find the existing modal (if any)
      const existingSdkErrorModal = state.stack.find((modal) => modal.name === 'SdkErrorModal');

      if (!existingSdkErrorModal) {
        // No modal exists yet, so create a new one with an array containing the error
        if (isCannotAddUserError(payload.errorCode)) {
          state.stack.push({
            name: 'CannotAddUsersModal',
            params: { errorInfo: payload },
          });
        } else {
          state.stack.push({
            name: 'SdkErrorModal',
            params: { errors: [payload] },
          });
        }
      } else {
        // Modal exists, just push to the errors array
        // We know params.errors exists because we always initialize it when creating the modal
        existingSdkErrorModal.params.errors.push(payload);
      }
    },

    dequeueSdkError: (state) => {
      // Find the existing modal (if any)
      const existingSdkErrorModal = state.stack.find((modal) => isSdkErrorModal(modal.name));
      if (!existingSdkErrorModal) return;

      // Remove the first error from the array
      existingSdkErrorModal.params.errors.shift();

      // If no more errors, remove the modal
      if (existingSdkErrorModal.params.errors.length === 0) {
        state.stack = state.stack.filter((modal) => modal.name !== 'SdkErrorModal');
      }
    },
  },
  extraReducers(builder) {
    builder.addCase(resetSlice, createResetSliceReducer('modal', initialState));
  },
});

export const modalReducer = modalSlice.reducer;
export const {
  pushModal: pushModalInternal,
  clearAllModals,
  enqueueSdkError,
  dequeueSdkError,
} = modalSlice.actions;

export function pushModal<K extends keyof ModalNameParamsMap>(payload: ModalParamsPayload<K>) {
  return pushModalInternal(payload);
}

const isSdkErrorModal = (modalName: ModalName) =>
  modalName === 'SdkErrorModal' || modalName === 'CannotAddUsersModal';
