import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { AppTranslationKey } from '@/lib/i18n';
import { resetSlice } from '@/store/slices/shared';
import { SigninState } from './signinModels';

const initialState: SigninState = {
  signinEmail: '',
  checkUserExistsErrorMsg: null,
  companyIdErrorMsg: null,
  recoverYourAccountErrorMsg: null,
  inviteCodeVerificationErrorMsg: '',
  passwordRegistrationErrorMsg: null,
  signinPassword: '',
  isUserLoggedIn: false,
  ssoCompanyID: '',
  // Master Recovery Key state
  base32Key: '',
  displayKey: '',
  // Device sync state
  devAuthKey: '',
  deviceVerifyKey: '',
};

export const signinSlice = createSlice({
  name: 'signin',
  initialState,
  reducers: {
    setSigninEmail: (state, { payload }: PayloadAction<string>) => {
      state.signinEmail = payload;
    },
    setCheckUserExistsErrorMsg: (state, { payload }: PayloadAction<AppTranslationKey | null>) => {
      state.checkUserExistsErrorMsg = payload;
    },
    setCompanyIdErrorMsg: (state, { payload }: PayloadAction<AppTranslationKey | null>) => {
      state.companyIdErrorMsg = payload;
    },
    setRecoverYourAccountErrorMsg: (
      state,
      { payload }: PayloadAction<AppTranslationKey | null>
    ) => {
      state.recoverYourAccountErrorMsg = payload;
    },
    setInviteCodeVerificationErrorMsg: (state, { payload }: PayloadAction<string>) => {
      state.inviteCodeVerificationErrorMsg = payload;
    },
    setSigninPassword: (state, { payload }: PayloadAction<string>) => {
      state.signinPassword = payload;
    },
    setSigninBase32Key: (state, { payload }: PayloadAction<string>) => {
      state.base32Key = payload;
    },
    setSigninDisplayKey: (state, { payload }: PayloadAction<string>) => {
      state.displayKey = payload;
    },
    setSigninDevAuthKey: (state, { payload }: PayloadAction<string>) => {
      state.devAuthKey = payload;
    },
    setSigninDeviceVerifyKey: (state, { payload }: PayloadAction<string>) => {
      state.deviceVerifyKey = payload;
    },
    setIsUserLoggedIn: (state, { payload }: PayloadAction<boolean>) => {
      state.isUserLoggedIn = payload;
    },
    setSSOCompanyID: (state, { payload }: PayloadAction<string>) => {
      state.ssoCompanyID = payload;
    },
    clearSigninState: () => initialState,
    setPasswordRegistrationErrorMsg: (state, { payload }: PayloadAction<AppTranslationKey>) => {
      state.passwordRegistrationErrorMsg = payload;
    },
  },
  extraReducers: (builder) => {
    builder.addCase(resetSlice, (_state, { payload }) => {
      if (payload === '*') return initialState;
    });
  },
});

export const signinReducer = signinSlice.reducer;
export const {
  setSigninEmail,
  setInviteCodeVerificationErrorMsg,
  setCheckUserExistsErrorMsg,
  setRecoverYourAccountErrorMsg,
  clearSigninState,
  setPasswordRegistrationErrorMsg,
  setSigninBase32Key,
  setSigninDisplayKey,
  setSigninDevAuthKey,
  setSigninDeviceVerifyKey,
  setSSOCompanyID,
  setCompanyIdErrorMsg,
  setSigninPassword,
  setIsUserLoggedIn,
} = signinSlice.actions;
