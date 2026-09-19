import { createSelector } from '@reduxjs/toolkit';
import { AppRootState } from '@/store/models';

const selectMeetings = (state: AppRootState) => state.meetings;
export const selectMeetingState = createSelector(selectMeetings, (m) => m.meetingState);
