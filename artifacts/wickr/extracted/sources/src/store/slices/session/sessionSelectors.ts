import { AppRootState } from '@/store/models';

const selectSession = (state: AppRootState) => state.session;

export const selectSessionExpiresAt = (state: AppRootState) =>
  selectSession(state).sessionExpiresAt;

export const selectReauthErrorMessage = (state: AppRootState) =>
  selectSession(state).reauthErrorMessage;

export const selectReauthIsSubmitting = (state: AppRootState) =>
  selectSession(state).reauthIsSubmitting;

export const selectShowSessionTimeoutMenuItem = (state: AppRootState) =>
  selectSession(state).showSessionTimeoutMenuItem;
