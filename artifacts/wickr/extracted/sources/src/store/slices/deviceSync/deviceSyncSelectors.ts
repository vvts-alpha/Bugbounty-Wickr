import { createSelector } from '@reduxjs/toolkit';
import { AppRootState } from '@/store/models';

const selectDeviceSync = (state: AppRootState) => state.deviceSync;

export const selectDeviceSyncCurrentView = createSelector(selectDeviceSync, (ds) => ds.currentView);

export const selectNewDeviceKey = createSelector(selectDeviceSync, (ds) => ds.newDeviceKey);

export const selectDeviceSyncVerifyKey = createSelector(
  selectDeviceSync,
  (ds) => ds.deviceSyncVerifyKey
);
