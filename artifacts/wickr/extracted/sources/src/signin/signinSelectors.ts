import { createSelector } from '@reduxjs/toolkit';
import { AppRootState } from '@/store/models';

const selectSignin = (state: AppRootState) => state.signin;

export const selectSigninEmail = createSelector(selectSignin, (signin) => signin.signinEmail);

export const selectCheckUserExistsErrorMsg = createSelector(
  selectSignin,
  (signin) => signin.checkUserExistsErrorMsg
);

export const selectCompanyIdErrorMsg = createSelector(
  selectSignin,
  (signin) => signin.companyIdErrorMsg
);

export const selectSSOCompanyID = createSelector(selectSignin, (signin) => signin.ssoCompanyID);

export const selectSigninDevAuthKey = createSelector(selectSignin, (signin) => signin.devAuthKey);

export const selectSigninDeviceVerifyKey = createSelector(
  selectSignin,
  (signin) => signin.deviceVerifyKey
);

export const selectSigninDisplayKey = createSelector(selectSignin, (signin) => signin.displayKey);

export const selectRecoverYourAccountErrorMsg = createSelector(
  selectSignin,
  (signin) => signin.recoverYourAccountErrorMsg
);

export const selectInviteCodeVerificationErrorMsg = createSelector(
  selectSignin,
  (signin) => signin.inviteCodeVerificationErrorMsg
);

export const selectPasswordRegistrationErrorMsg = createSelector(
  selectSignin,
  (signin) => signin.passwordRegistrationErrorMsg
);

export const selectSigninPassword = createSelector(selectSignin, (signin) => signin.signinPassword);

export const selectIsUserLoggedIn = createSelector(selectSignin, (signin) => signin.isUserLoggedIn);
