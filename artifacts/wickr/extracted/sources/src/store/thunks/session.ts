import { secondsToMilliseconds } from 'date-fns';
import {
  setSessionExpiresAt,
  setReauthErrorMessage,
  setReauthIsSubmitting,
  setShowSessionTimeoutMenuItem,
  selectSessionExpiresAt,
} from '../slices/session';
import { createAppAsyncThunk } from '../utils';
import { ReauthenticationResult } from '@/apis/webChannel/BridgeWebChannel';
import { skewNow } from '@/utils/date';
import { closeModal } from './modals';
import { pushToast } from './toasts';

export const reauthenticateSession = createAppAsyncThunk(
  `session/reauthenticateSession`,
  async (password: string, { dispatch, extra }) => {
    dispatch(setReauthIsSubmitting(true));
    return extra.bridge.reauthenticateSession(password);
  }
);

export const handleReauthenticationResult = createAppAsyncThunk(
  `session/handleReauthenticationResult`,
  async (result: ReauthenticationResult, { dispatch, extra }) => {
    const { t } = extra;

    dispatch(setReauthIsSubmitting(false));

    if (result.success) {
      dispatch(setShowSessionTimeoutMenuItem(false));
      dispatch(closeModal('SessionExpiringModal'));
      dispatch(
        pushToast({
          label: t('Session renewed'),
          icon: 'check',
          color: 'green',
          id: 'reauthentication-success',
        })
      );
    } else {
      let errorMessage: string;

      switch (result.errorCode) {
        case 13:
          errorMessage = t('Password is incorrect');
          break;
        case -100:
          errorMessage = t('A network error has occurred, please try again.');
          break;
        default:
          errorMessage = t('FileManagement.SomethingWentWrong');
          break;
      }

      dispatch(setReauthErrorMessage(errorMessage));
    }
  }
);

export const updateSessionExpiresAt = createAppAsyncThunk(
  `session/updateSessionExpiresAt`,
  async (sessionExpiresAt: number, { dispatch, getState, extra }) => {
    const sessionExpiresAtMs = secondsToMilliseconds(sessionExpiresAt);

    if (sessionExpiresAtMs !== selectSessionExpiresAt(getState())) {
      dispatch(setSessionExpiresAt(sessionExpiresAtMs));

      // A non-positive value (native uses -1) means session timeout has been
      // disabled. Stop the countdown and clear any active warning UI immediately.
      if (sessionExpiresAtMs <= 0) {
        dispatch(setShowSessionTimeoutMenuItem(false));
        dispatch(closeModal('SessionExpiringModal'));
        return;
      }

      const firstWarningSeconds = await extra.environmentMgr.getSessionFirstWarningSeconds();
      const remainingMs = sessionExpiresAtMs - skewNow();
      if (remainingMs > secondsToMilliseconds(firstWarningSeconds)) {
        dispatch(setShowSessionTimeoutMenuItem(false));
        dispatch(closeModal('SessionExpiringModal'));
      }
    }
  }
);

export const fetchSessionExpiresAt = createAppAsyncThunk(
  `session/fetchSessionExpiresAt`,
  async (_: undefined, { dispatch, extra }) => {
    const sessionExpiresAt = await extra.environmentMgr.getSessionExpiresAt();
    dispatch(updateSessionExpiresAt(sessionExpiresAt));
  }
);
