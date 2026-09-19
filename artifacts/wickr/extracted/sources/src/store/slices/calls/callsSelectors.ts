import { createSelector } from '@reduxjs/toolkit';
import { AppRootState } from '@/store/models';

const selectCalls = (state: AppRootState) => state.calls;

export const selectSelfCallStatus = createSelector(
  selectCalls,
  (meeting) => meeting.selfCallStatus
);

export const selectIsCallShuttingDown = createSelector(
  selectCalls,
  (meeting) => meeting.isCallShuttingDown
);
