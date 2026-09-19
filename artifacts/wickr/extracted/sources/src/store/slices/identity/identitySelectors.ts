import { createSelector } from '@reduxjs/toolkit';
import { AppRootState } from '@/store/models';

const selectIdentity = (state: AppRootState) => state.identity;

export const selectIsLoggedIn = createSelector(selectIdentity, (id) => id.isLoggedIn);

export const selectSelfUserIdHash = createSelector(selectIdentity, (id) => id.selfUserIdHash ?? '');

export const selectSelfUser = createSelector(
  (state: AppRootState) => state.users.all,
  selectSelfUserIdHash,
  (users, id) => (id ? users[id] : undefined)
);

export const selectSelfUserEmail = createSelector(selectSelfUser, (me) => me?.id ?? '');

export const selectSelfUserIsGuest = createSelector(selectSelfUser, (me) => Boolean(me?.isGuest));
