import { createAsyncThunk } from '@reduxjs/toolkit';
import { ThunkExtraArgument } from './AppStoreProvider';
import { AppRootState } from './models';
import { AppDispatch } from '.';

export const createAppAsyncThunk = createAsyncThunk.withTypes<{
  state: AppRootState;
  dispatch: AppDispatch;
  rejectValue: unknown;
  extra: ThunkExtraArgument;
}>();

/**
 * Used to define type for async thunk helper function
 */
export type ThunkAPI = {
  getState: () => AppRootState;
  dispatch: AppDispatch;
  extra: ThunkExtraArgument;
  abort: (reason?: string | undefined) => void;
  fulfillWithValue: <FulfilledValue>(value: FulfilledValue) => FulfilledValue;
  rejectWithValue: (value: unknown) => any; // FIXME: return type should be RejectWithValue, but we don't have access to it
  requestId: string;
  signal: AbortSignal;
};
