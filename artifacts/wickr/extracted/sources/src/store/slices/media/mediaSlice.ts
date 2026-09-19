import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { createResetSliceReducer, resetSlice } from '../shared';
import { createAppAsyncThunk } from '@/store/utils';
import { MediaPermission, MediaState } from './mediaModels';

const initialState: MediaState = {
  audioInput: {
    deviceId: 'default',
    permission: 'UNSET',
  },
  audioOutput: {
    deviceId: 'default',
  },
  video: {
    deviceId: 'default',
    permission: 'UNSET',
  },
};

export const mediaSlice = createSlice({
  name: 'media',
  initialState,
  reducers: {
    setAudioInputDeviceId: (state, { payload }: PayloadAction<string>) => {
      state.audioInput.deviceId = payload;
    },
    setAudioInputDevicePermission: (state, { payload }: PayloadAction<MediaPermission>) => {
      state.audioInput.permission = payload;
    },
    setAudioOutputDeviceId: (state, { payload }: PayloadAction<string>) => {
      state.audioOutput.deviceId = payload;
    },
    setVideoDeviceId: (state, { payload }: PayloadAction<string>) => {
      state.video.deviceId = payload;
    },
    setVideoDevicePermission: (state, { payload }: PayloadAction<MediaPermission>) => {
      state.video.permission = payload;
    },
  },
  extraReducers(builder) {
    builder.addCase(resetSlice, createResetSliceReducer('media', initialState));
  },
});

export const mediaReducer = mediaSlice.reducer;
export const {
  setAudioInputDeviceId,
  setAudioInputDevicePermission,
  setAudioOutputDeviceId,
  setVideoDeviceId,
  setVideoDevicePermission,
} = mediaSlice.actions;

export const promptForMediaDevicePermission = createAppAsyncThunk(
  `${mediaSlice.name}/promptForMediaDevicePermission`,
  async ({ audio, video }: { audio: boolean; video: boolean }, { dispatch }) => {
    try {
      // PermissionName 'microphone' is not supported in Firefox
      const audioPermission = await navigator.permissions.query({ name: 'microphone' } as any);
      if (audioPermission.state === 'granted') {
        dispatch(setAudioInputDevicePermission('GRANTED'));
        audio = false;
      }
      // PermissionName 'camera' is not supported in Firefox
      const videoPermission = await navigator.permissions.query({ name: 'camera' } as any);
      if (videoPermission.state === 'granted') {
        dispatch(setVideoDevicePermission('GRANTED'));
        video = false;
      }
    } catch (error) {
      console.error('promptForMediaDevicePermission', error);
    }
    if (!audio && !video) {
      return;
    }
    try {
      await navigator.mediaDevices.getUserMedia({ audio, video });
      audio && dispatch(setAudioInputDevicePermission('GRANTED'));
      video && dispatch(setVideoDevicePermission('GRANTED'));
    } catch (error: any) {
      const errorName = error?.name;
      if (errorName === 'NotAllowedError') {
        audio && dispatch(setAudioInputDevicePermission('DENIED'));
        video && dispatch(setVideoDevicePermission('DENIED'));
      }
    }
  }
);
