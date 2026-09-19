import { createSelector } from '@reduxjs/toolkit';
import { AppRootState } from '@/store/models';

const selectApp = (state: AppRootState) => state.windows;

export const selectChatWindowHasFocus = createSelector(selectApp, (app) => app.isChatWindowFocused);
