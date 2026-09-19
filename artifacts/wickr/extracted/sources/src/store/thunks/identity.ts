import { selectIsFeatureEnabled } from '../slices/features';
import { setIsLoggedIn, setSelfUserIdHash } from '../slices/identity';
import { resetSlice } from '../slices/shared';
import { setUIAppName } from '../slices/uiApp';
import { upsertUsers } from '../slices/users';
import { createAppAsyncThunk } from '../utils';
import {
  GetUserStatusPayload,
  PubKeyBytesPayload,
  PushDeviceCodePayload,
  SendEmailPayload,
} from '@/apis/webChannel/BridgeWebChannel';
import { changePassword, getSelfUser, inviteUser } from '@/apis/webFetch';
import { Logger } from '@/lib/logger';
import { signingOutGuard } from './signingOutGuard';

const logger = new Logger('store/identity');

export type ChangePasswordPayload = {
  oldPassword: string;
  newPassword: string;
};

export const loginUser = createAppAsyncThunk(
  'identity/loginUser',
  async (_: undefined, { dispatch }) => {
    logger.info('logging in');
    dispatch(setIsLoggedIn(true));
    const user = await getSelfUser();
    if (!user) throw new Error('getSelfUser: no user found');
    dispatch(setSelfUserIdHash(user.idHash));
    dispatch(upsertUsers([user]));
  }
);

export const logoutUser = createAppAsyncThunk(
  'identity/logoutUser',
  (_: undefined, { dispatch, extra }) => {
    logger.info('logging out');

    // Clear message cache
    extra.messageCaches.clear();

    // Reset the store
    dispatch(resetSlice('*'));

    // TODO: Is this still necessary?
    // And explicitly log out user
    dispatch(setIsLoggedIn(false));
  }
);

export const quitApp = createAppAsyncThunk(`identity/quitApp`, async (_, { extra }) => {
  await extra.bridge.quitApp();
});

export const signOut = createAppAsyncThunk(
  `identity/signOut`,
  async (_, { dispatch, getState, extra }) => {
    // Guard against re-entrant signOut: set before bridge.signOut() so that
    // OnboardingSubscriptions ignores the onboardingPageChanged(EnterEmail)
    // signal the native side emits in response to the bridge call.
    signingOutGuard.current = true;
    try {
      // Clear persistent storage on intentional sign-out
      await extra.storage.clear();
      // TODO: Remove signin flag check when web signin flow is ready
      const isSigninEnabled = selectIsFeatureEnabled(getState(), 'Signin');
      await extra.bridge.signOut();
      if (isSigninEnabled) {
        await dispatch(logoutUser());
        dispatch(setUIAppName('signin'));
      }
    } finally {
      signingOutGuard.current = false;
    }
  }
);

export const attemptChangePassword = createAppAsyncThunk(
  `identity/attemptChangePassword`,
  async (payload: ChangePasswordPayload) => {
    const { oldPassword, newPassword } = payload;
    return changePassword(oldPassword, newPassword);
  }
);

export const fetchUserStatus = createAppAsyncThunk(
  `identity/fetchUserStatus`,
  async (payload: GetUserStatusPayload, { extra }) => {
    extra.bridge.getUserStatus(payload);
  }
);

export const sendEmail = createAppAsyncThunk(
  `identity/sendEmail`,
  async (payload: SendEmailPayload, { extra }) => {
    logger.info('sendEmail');
    return extra.bridge.sendEmail(payload);
  }
);

export const attemptInviteUser = createAppAsyncThunk(
  `identity/inviteUser`,
  async (payload: string) => {
    return inviteUser(payload);
  }
);

export const attemptSsoTerminateAccount = createAppAsyncThunk(
  `identity/attemptSsoTerminateAccount`,
  async (_, { extra }) => {
    return extra.bridge.initiateSsoTerminateAccount();
  }
);

export const confirmSsoTerminateAccount = createAppAsyncThunk(
  `identity/confirmSsoTerminateAccount`,
  async (_, { extra }) => {
    return extra.bridge.confirmSsoTerminateAccount();
  }
);

export const pushDeviceQRScan = createAppAsyncThunk(
  `identity/pushDeviceQRScan`,
  async (payload: PubKeyBytesPayload, { extra }) => {
    return extra.bridge.pushDeviceQRScan(payload);
  }
);

export const switchToCode = createAppAsyncThunk(
  `identity/switchToCode`,
  async (payload: PubKeyBytesPayload, { extra }) => {
    return extra.bridge.switchToCode(payload);
  }
);

export const pushDeviceCode = createAppAsyncThunk(
  `identity/pushDeviceCode`,
  async (payload: PushDeviceCodePayload, { extra }) => {
    return extra.bridge.pushDeviceCode(payload);
  }
);

export const blockATORequest = createAppAsyncThunk(
  `identity/blockATORequest`,
  async (_: undefined, { extra }) => {
    return extra.bridge.blockATORequest();
  }
);
