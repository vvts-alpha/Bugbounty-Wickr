import { createSelector } from '@reduxjs/toolkit';
import { AppRootState } from '@/store/models';

const selectUIApp = (state: AppRootState) => state.uiApp;

export const selectUIAppName = createSelector(selectUIApp, (uiApp) => uiApp.appName);
