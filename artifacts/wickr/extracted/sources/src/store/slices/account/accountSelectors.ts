import { createSelector } from '@reduxjs/toolkit';
import { AppRootState } from '@/store/models';

const selectAccount = (state: AppRootState) => state.account;
export const selectQuickResponses = createSelector(selectAccount, (acc) => acc.quickResponses);

export const selectIsAdmin = createSelector(selectAccount, (acc) => acc.selfAttributes.isAdmin);

export const selectNetworkInvitesAllowed = createSelector(
  selectAccount,
  (acc) => acc.selfAttributes.allowNetworkInvites
);

export const selectIsAwsNetwork = createSelector(
  selectAccount,
  (acc) => acc.selfAttributes.isAwsNetwork
);
