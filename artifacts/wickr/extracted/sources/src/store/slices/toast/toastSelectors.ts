import { createSelector } from '@reduxjs/toolkit';
import { AppRootState } from '@/store/models';

const selectRoot = (state: AppRootState) => state.toast;

export const selectToasts = createSelector(selectRoot, (toast) => toast.toasts);
