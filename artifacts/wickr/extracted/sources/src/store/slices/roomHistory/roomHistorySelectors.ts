import { createSelector } from '@reduxjs/toolkit';
import { AppRootState } from '@/store/models';

const selectRoomHistory = (state: AppRootState) => state.roomHistory;

export const selectAllRoomHistoryMap = createSelector(
  selectRoomHistory,
  (roomHistory) => roomHistory.all
);

export const selectRoomHistoryByConvoId = createSelector(
  selectAllRoomHistoryMap,
  (_: any, convoId: string) => convoId,
  (roomHistories, convoId) => roomHistories[convoId] || []
);
