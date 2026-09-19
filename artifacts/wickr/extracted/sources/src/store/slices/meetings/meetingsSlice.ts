import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { resetSlice, createResetSliceReducer } from '../shared';
import { MeetingState } from '@/components/WickrMeetings/models';
import { MeetingsState } from './meetingsModels';

const initialState: MeetingsState = {
  meetingState: 'READY',
};

export const meetingsSlice = createSlice({
  name: 'meetings',
  initialState,
  reducers: {
    setMeetingState: (state, { payload }: PayloadAction<MeetingState>) => {
      state.meetingState = payload;
    },
    clearMeetingsState: () => {
      return {
        ...initialState,
      };
    },
  },
  extraReducers(builder) {
    builder.addCase(resetSlice, createResetSliceReducer('meetings', initialState));
  },
});

export const meetingsReducer = meetingsSlice.reducer;
export const { setMeetingState, clearMeetingsState } = meetingsSlice.actions;
