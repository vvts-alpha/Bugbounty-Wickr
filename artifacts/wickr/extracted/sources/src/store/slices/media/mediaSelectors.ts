import { createSelector } from '@reduxjs/toolkit';
import { AppRootState } from '@/store/models';

const selectMedia = (state: AppRootState) => state.media;
export const selectAudioInputDeviceId = createSelector(selectMedia, (m) => m.audioInput.deviceId);
export const selectAudioInputDevicePermission = createSelector(
  selectMedia,
  (m) => m.audioInput.permission
);
export const selectAudioOutputDeviceId = createSelector(selectMedia, (m) => m.audioOutput.deviceId);
export const selectVideoDeviceId = createSelector(selectMedia, (m) => m.video.deviceId);
export const selectVideoDevicePermission = createSelector(selectMedia, (m) => m.video.permission);
