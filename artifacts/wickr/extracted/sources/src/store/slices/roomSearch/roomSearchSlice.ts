import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { createResetSliceReducer, resetSlice } from '../shared';
import { RoomSearchState, SearchItem } from './roomSearchModels';

const initialState: RoomSearchState = {
  results: [],
};

export const roomSearchSlice = createSlice({
  name: 'roomSearch',
  initialState,
  reducers: {
    setRoomSearchItems: (state, { payload }: PayloadAction<SearchItem[]>) => {
      state.results = payload;
    },
    removeDeletedSearchItem: (state, { payload }: PayloadAction<string>) => {
      state.results = state.results.filter((item) => {
        if ((item.type === 'file' || item.type === 'message') && item?.msgId === payload)
          return false;
        return true;
      });
    },
  },
  extraReducers(builder) {
    builder.addCase(resetSlice, createResetSliceReducer('roomSearch', initialState));
  },
});

export const roomSearchReducer = roomSearchSlice.reducer;
export const { setRoomSearchItems, removeDeletedSearchItem } = roomSearchSlice.actions;
