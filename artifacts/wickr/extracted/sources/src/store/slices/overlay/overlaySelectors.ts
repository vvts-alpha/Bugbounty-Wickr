import { createSelector } from '@reduxjs/toolkit';
import { AppRootState } from '@/store/models';

const selectOverlayRoot = (appState: AppRootState) => {
  return appState.overlay;
};

export const selectActiveOverlay = createSelector(selectOverlayRoot, (overlayState) => {
  return overlayState.overlay;
});

export const selectActiveOverlayParams = createSelector(selectOverlayRoot, (overlayState) => {
  return overlayState.overlayParams;
});
