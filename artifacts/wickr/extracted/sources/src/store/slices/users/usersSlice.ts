import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { createResetSliceReducer, resetSlice } from '../shared';
import { WickrUser } from '@/lib/protobuf/users';
import { UsersState } from './usersModels';

const initialState: UsersState = {
  all: {},
  directory: {},
  avatarVersions: {},
};

export const usersSlice = createSlice({
  name: 'users',
  initialState,
  reducers: {
    upsertUsers: (state, { payload }: PayloadAction<WickrUser[]>) => {
      payload.forEach((user) => {
        state.all[user.idHash] = user;
      });
    },
    removeUsers: (state, { payload }: PayloadAction<string[]>) => {
      payload.forEach((idHash) => {
        delete state.all[idHash];
      });
    },
    upsertDirectoryUsers: (state, { payload }: PayloadAction<WickrUser[]>) => {
      payload.forEach((user) => {
        state.directory[user.idHash] = user;
      });
    },
    setUserTimeIdle: (
      state,
      {
        payload: { idHash, timeIdle },
      }: PayloadAction<{ idHash: string; timeIdle: number | undefined }>
    ) => {
      const user = state.all[idHash];
      if (user) {
        user.timeIdle = timeIdle ?? -1;
      }
    },
    incrementAvatarVersion: (state, { payload }: PayloadAction<string>) => {
      state.avatarVersions[payload] = (state.avatarVersions[payload] || 0) + 1;
    },
  },
  extraReducers(builder) {
    builder.addCase(resetSlice, createResetSliceReducer('users', initialState));
  },
});

export const usersReducer = usersSlice.reducer;
export const {
  upsertUsers,
  removeUsers,
  setUserTimeIdle,
  upsertDirectoryUsers,
  incrementAvatarVersion,
} = usersSlice.actions;
