import { createSelector } from '@reduxjs/toolkit';
import { AppRootState } from '@/store/models';

const selectApp = (state: AppRootState) => state.os;

export const selectIsOSSleep = createSelector(selectApp, (app) => app.isOSSleep);
