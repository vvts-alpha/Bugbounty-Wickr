import { combineSlices } from '@reduxjs/toolkit';
import { signinSlice } from '@/signin/signinSlice';
import { accountSlice } from './slices/account';
import { callsSlice } from './slices/calls';
import { coachMarksSlice } from './slices/coachMarks';
import { convosSlice } from './slices/convos';
import { deviceSyncSlice } from './slices/deviceSync';
import { featuresSlice } from './slices/features';
import { filesSlice } from './slices/files';
import { identitySlice } from './slices/identity';
import { mediaSlice } from './slices/media';
import { meetingsSlice } from './slices/meetings';
import { modalSlice } from './slices/modal';
import { osSlice } from './slices/os';
import { overlaySlice } from './slices/overlay';
import { panelsSlice } from './slices/panels';
import { roomHistorySlice } from './slices/roomHistory';
import { roomSearchSlice } from './slices/roomSearch';
import { sessionSlice } from './slices/session';
import { settingsSlice } from './slices/settings';
import { toastSlice } from './slices/toast';
import { uiAppSlice } from './slices/uiApp';
import { uiChatSlice } from './slices/uiChat';
import { usersSlice } from './slices/users';
import { windowsSlice } from './slices/windows';

export const rootReducer = combineSlices(
  accountSlice,
  callsSlice,
  coachMarksSlice,
  convosSlice,
  featuresSlice,
  filesSlice,
  identitySlice,
  mediaSlice,
  modalSlice,
  osSlice,
  panelsSlice,
  overlaySlice,
  settingsSlice,
  toastSlice,
  uiAppSlice,
  uiChatSlice,
  usersSlice,
  windowsSlice,
  roomHistorySlice,
  roomSearchSlice,
  sessionSlice,
  meetingsSlice,
  deviceSyncSlice,
  signinSlice
);
