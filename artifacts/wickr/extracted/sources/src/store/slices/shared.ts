import { createAction, createSelector, PayloadAction } from '@reduxjs/toolkit';
import { AppRootState, SliceName } from '../models';

/** Reset a slice to its initial state. Pass it '*' to reset all slices */
export const resetSlice = createAction<SliceName | '*'>('shared/resetSlice');

/**
 * Creates a reducer that resets a slice to its initial state.
 * @param sliceName - The name of the slice to reset
 * @param initialState - The initial state to reset to
 * @returns A reducer function that handles resetSlice actions
 */
export function createResetSliceReducer<T extends SliceName>(
  sliceName: T,
  initialState: AppRootState[T]
) {
  return (state: AppRootState[T], { payload }: PayloadAction<SliceName | '*'>) => {
    if (payload === sliceName || payload === '*') {
      return initialState;
    }
    return state;
  };
}

function selectRootState(state: AppRootState) {
  return state;
}

/** Select the active convo ID */
export function selectActiveConvoId(state: AppRootState) {
  return state.uiChat.activeConvoId;
}

/**
 * Takes a selector that expect root + convoId and creates a selector that uses active convo ID.
 * Cannot be used for selectors that expect additional arguments, e.g., msgId
 */
export function createActiveConvoSelector<S extends (root: AppRootState, convoId: string) => any>(
  convoSelector: S
) {
  return createSelector<[(root: AppRootState) => AppRootState], ReturnType<S>>(
    selectRootState,
    selectActiveConvoId as any,
    convoSelector as any
  );
}

/**
 * @deprecated This selector is unstable because any change to a convo will cause a re-render.
 * Use specific selectors instead (e.g., selectActiveConvoType). This is only for debug purposes.
 */
export const selectActiveConvoDebugOnly = createSelector(
  selectActiveConvoId,
  (state: AppRootState) => state.convos.all,
  (id, convos) => convos[id]
);
