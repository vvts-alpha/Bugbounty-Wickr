import { createSelector } from '@reduxjs/toolkit';
import { AppRootState } from '@/store/models';
import {
  ConvoSearchItem,
  FileSearchItem,
  MessageSearchItem,
  SearchSearchItem,
  StarSearchItem,
} from './roomSearchModels';

const selectAllSearchItems = (state: AppRootState) => state.roomSearch.results;

export const selectConvoSearchItems = createSelector(
  selectAllSearchItems,
  (items) => items.filter((item) => item.type === 'convo') as ConvoSearchItem[]
);
export const selectFileSearchItems = createSelector(
  selectAllSearchItems,
  (items) => items.filter((item) => item.type === 'file') as FileSearchItem[]
);
export const selectMessageSearchItems = createSelector(
  selectAllSearchItems,
  (items) => items.filter((item) => item.type === 'message') as MessageSearchItem[]
);
export const selectStarSearchItems = createSelector(
  selectAllSearchItems,
  (items) => items.filter((item) => item.type === 'star') as StarSearchItem[]
);
export const selectSearchSearchItems = createSelector(
  selectAllSearchItems,
  (items) => items.filter((item) => item.type === 'search') as SearchSearchItem[]
);
