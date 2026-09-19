import { AnyAction } from '@reduxjs/toolkit';
import {
  AlertModalParams,
  ModalName,
  ModalNameParamsMap,
  modalSlice,
  pushModal,
  selectModalStack,
  ModalParamsPayload,
} from '../slices/modal';
import { createAppAsyncThunk } from '../utils';

type CloseModalPayload = { name: ModalName; returnValue?: any };

/**
 * Closes a modal and provides an optional return value.
 */
export const closeModal = createAppAsyncThunk(
  `modals/closeModal`,
  async (payload: CloseModalPayload | ModalName, { dispatch }) => {
    dispatch(modalSlice.actions.clearModal(typeof payload === 'string' ? payload : payload.name));
  }
);

/** Internally defined thunk. Wrapped with openModal to get proper typing. */
const openModalInternal = createAppAsyncThunk(
  `modals/openModal`,
  async (modal: ModalParamsPayload<any>, { dispatch, extra, signal }): Promise<unknown> => {
    dispatch(pushModal(modal));
    const modalName = typeof modal === 'string' ? modal : modal.name;

    const isMatchingCloseModalAction = (action: AnyAction) => {
      const isCloseModalAction = action.type === closeModal.pending.type;
      const match =
        isCloseModalAction &&
        (action.meta.arg === modalName || action.meta.arg?.name === modalName);
      return match;
    };

    let returnValue: unknown;

    await extra.thunkWhenStoreListener({
      predicate(action, currentState) {
        // if not found, the modal is gone and we should stop listening
        if (currentState) {
          const stack = selectModalStack(currentState);
          const found = stack.find(({ name }) => name === modalName);
          if (!found) {
            return true;
          }
        }

        // look for matching state...
        if (isMatchingCloseModalAction(action)) {
          returnValue = action.meta?.arg?.returnValue;
          return true;
        }
        return false;
      },
      signal,
    });

    return returnValue;
  }
);

/**
 * Opens a modal and waits for it to be dismissed (closed, another modal overrides it, etc)
 * and returns any return value from it if closeModal was used. Otherwise it returns undefined.
 * Recommended to use with useAbortableDispatch when awaiting the return value.
 *
 * @returns A promise that resolves when the modal is dismissed, and includes a return value, if provided.
 */
export function openModal<K extends keyof ModalNameParamsMap>(payload: ModalParamsPayload<K>) {
  return openModalInternal(payload);
}

export const openAlertModal = createAppAsyncThunk(
  `modals/openAlertModal`,
  async (payload: AlertModalParams, { dispatch }) => {
    return dispatch(openModal({ name: 'AlertModal', params: payload }));
  }
);
