import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { createResetSliceReducer, resetSlice } from '../shared';
import { RoomHistoryState, RoomHistoryItem } from './roomHistoryModels';

const initialState: RoomHistoryState = {
  all: {},
};

export const roomHistorySlice = createSlice({
  name: 'roomHistory',
  initialState,
  reducers: {
    setRoomHistoryForConvoId: (
      state,
      { payload: { convoId, items } }: PayloadAction<{ convoId: string; items: RoomHistoryItem[] }>
    ) => {
      state.all[convoId] = items;
    },
  },
  extraReducers(builder) {
    builder.addCase(resetSlice, createResetSliceReducer('roomHistory', initialState));
  },
});

export const roomHistoryReducer = roomHistorySlice.reducer;
export const { setRoomHistoryForConvoId } = roomHistorySlice.actions;
