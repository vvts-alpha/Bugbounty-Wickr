import {
  CheckUserExistsPayload,
  OnboardingPage,
  OnboardingPageChangedResult,
  ProcessRegistrationResult,
  CheckUserExistsResult,
  VerifyInviteCodePayload,
  InitiateLoginPayload,
  OnboardingLoginResult,
  CheckEmailResult,
  SSOAccountHandlerResult,
  OnboardState,
  StartSSOProvisionPayload,
  OnboardingSSOResult,
  LoadBootstrapFilePayload,
  LoadBootstrapFileResult,
} from '@/apis/webChannel/OnboardingWebChannel';
import { generateChatRoute } from '@/chat/routes';
import { Logger } from '@/lib/logger';
import { setUIAppName } from '@/store/slices/uiApp';
import { loginUser } from '@/store/thunks/identity';
import { openAlertModal } from '@/store/thunks/modals';
import { createAppAsyncThunk } from '@/store/utils';
import { generateSigninRoute } from './routes';
import {
  setCheckUserExistsErrorMsg,
  setCompanyIdErrorMsg,
  setIsUserLoggedIn,
  setRecoverYourAccountErrorMsg,
  setSigninBase32Key,
  setSigninDevAuthKey,
  setSigninDeviceVerifyKey,
  setSigninDisplayKey,
  setSigninEmail,
  setSSOCompanyID,
} from './signinSlice';

const logger = new Logger('store/signin');

export const determineInitialState = createAppAsyncThunk(
  `signin/determineInitialState`,
  async (_: undefined, { dispatch, extra }) => {
    const settings = await extra.onboardingBridge.determineInitialState();
    if (settings.isUserLoggedIn) {
      // need to save this separately as signinEmail can exist w/o user logged in true
      dispatch(setIsUserLoggedIn(true));
      dispatch(setSigninEmail(settings.email));
      if (settings.ssoEnabled) {
        extra.navigate(generateSigninRoute.ssoEnterEmail());
      } else {
        extra.navigate(generateSigninRoute.nonSSOPassword());
      }
    } else {
      if (settings.isEnterprise) {
        extra.navigate(generateSigninRoute.enterpriseConfigure());
      } else if (settings.awsWickrEnabled) {
        extra.navigate(generateSigninRoute.landing());
      } else {
        // WickrPro?
      }
    }
    logger.info('determineInitialState', settings);
    return settings;
  }
);

export const ssoAccountHandler = createAppAsyncThunk(
  `signin/ssoAccountHandler`,
  async (email: string, { extra }) => {
    return extra.onboardingBridge.ssoAccountHandler(email);
  }
);

export const ssoResetAccount = createAppAsyncThunk(
  `signin/ssoResetAccount`,
  async (companyID: string, { extra }) => {
    return extra.onboardingBridge.ssoResetAccount(companyID);
  }
);

export const checkUserExists = createAppAsyncThunk(
  `signin/checkUserExists`,
  async (payload: CheckUserExistsPayload, { extra }) => {
    logger.info('checkUserExists', payload);
    const result = await extra.onboardingBridge.checkUserExists(payload);
    // actual result comes from checkUserExistsResult signal
    return result;
  }
);

export const handleCheckUserExistsResult = createAppAsyncThunk(
  `signin/handleCheckUserExistsResult`,
  async (payload: CheckUserExistsResult, { dispatch, extra }) => {
    if (payload.companyID) {
      dispatch(setSSOCompanyID(payload.companyID));
    } else {
      dispatch(setSSOCompanyID(''));
    }

    if (payload.showGuestSignup) {
      extra.navigate(generateSigninRoute.signUp());
    } else if (payload.onboardState === OnboardState.SSOCompanyID) {
      if (payload.isSSO) {
        extra.navigate(generateSigninRoute.companyID());
      } else if (payload.isInvited) {
        extra.navigate(generateSigninRoute.checkYourEmailInviteCode());
      } else if (payload.message) {
        dispatch(setCheckUserExistsErrorMsg(payload.message));
      }
    } else if (payload.onboardState === OnboardState.NONSSOPassword) {
      extra.navigate(generateSigninRoute.nonSSOPassword());
    } else if (payload.onboardState === OnboardState.NONSSOCheckYourEmail) {
      extra.navigate(generateSigninRoute.checkYourEmailInviteCode());
    } else if (payload.message) {
      dispatch(setCheckUserExistsErrorMsg(payload.message));
    }
  }
);

export const verifyInviteCode = createAppAsyncThunk(
  `signin/verifyInviteCode`,
  async (payload: VerifyInviteCodePayload, { extra }) => {
    logger.info('verifyInviteCode', payload);
    extra.onboardingBridge.verifyInviteCode(payload);
  }
);

export const handleOnboardingPageChanged = createAppAsyncThunk(
  `signin/handleOnboardingPageChanged`,
  async (payload: OnboardingPageChangedResult, { dispatch, extra }) => {
    logger.info('handleOnboardingPageChanged:', payload);
    // https://code.amazon.com/packages/WickrDesktopApp/blobs/ab09c44572cf456ec7067854a7adb5b5b7ec7766/--/clients/enterprise/qml/AWSWickrProOnBoarding/AWSOnBoarding.qml#L172
    if (payload.page === OnboardingPage.EnterEmail) {
      extra.navigate(generateSigninRoute.landing());
    } else if (payload.page === OnboardingPage.VerifyEmail) {
      extra.navigate(generateSigninRoute.checkYourEmail());
    } else if (payload.page === OnboardingPage.EnterPassword) {
      extra.navigate(generateSigninRoute.nonSSOCreatePassword());
    } else if (payload.page === OnboardingPage.AskJoinNetwork) {
      // TODO: check ui
    } else if (payload.page === OnboardingPage.ScanQRCode && payload.devAuthKey) {
      dispatch(setSigninDevAuthKey(payload.devAuthKey));
      dispatch(requestDeviceInfo());
      extra.navigate(generateSigninRoute.transferData());
    } else if (
      payload.page === OnboardingPage.MasterRecoveryKey &&
      payload.base32Key &&
      payload.displayKey
    ) {
      dispatch(setSigninBase32Key(payload.base32Key));
      dispatch(setSigninDisplayKey(payload.displayKey));
      extra.navigate(generateSigninRoute.masterRecoveryKey());
    } else if (payload.page === OnboardingPage.NewUserAgreement) {
      // TODO: implement new user agreement page
    }
  }
);

export const registerWithPassword = createAppAsyncThunk(
  `signin/registerWithPassword`,
  async (payload: string, { extra }) => {
    extra.onboardingBridge.registerWithPassword(payload);
  }
);

export const handleProcessRegistrationResult = createAppAsyncThunk(
  `signin/handleProcessRegistrationResult`,
  async (payload: ProcessRegistrationResult, { dispatch, extra }) => {
    logger.info('handleProcessRegistrationResult:', payload);
    if (payload.success) {
      await dispatch(loginUser()).unwrap();
      dispatch(setUIAppName('chat'));
      extra.navigate(generateChatRoute.landing());
    } else if (payload.errorType === 'ato_required') {
      extra.navigate(generateSigninRoute.verifyDevice());
    } else if (payload.errorType === 'invalid_Login_should_be_sso_login') {
      extra.navigate(generateSigninRoute.companyID());
    }
  }
);

export const initiateLogin = createAppAsyncThunk(
  `signin/initiateLogin`,
  async (payload: InitiateLoginPayload, { extra }) => {
    extra.onboardingBridge.initiateLogin(payload);
  }
);

export const handleLoginResult = createAppAsyncThunk(
  `signin/handleLoginResult`,
  async (payload: OnboardingLoginResult, { dispatch, extra }) => {
    logger.info('handleLoginResult:', payload);
    if (payload.success) {
      await dispatch(loginUser()).unwrap();
      dispatch(setUIAppName('chat'));
      extra.navigate(generateChatRoute.landing());
    } else if (payload.errorCode && payload.errorMsg) {
      dispatch(openAlertModal({ title: '', body: payload.errorMsg }));
    } else if (payload.screen === 'showLoginScreenWithOTP') {
      extra.navigate(generateSigninRoute.signin2FA());
    } else if (payload.resetUI) {
      extra.navigate(generateSigninRoute.landing());
      dispatch(determineInitialState());
    }
  }
);

export const resetPassword = createAppAsyncThunk(
  `signin/resetPassword`,
  async (payload: string, { extra }) => {
    extra.onboardingBridge.resetPassword(payload);
  }
);

export const handleCheckEmailResult = createAppAsyncThunk(
  `signin/handleCheckEmailResult`,
  async (payload: CheckEmailResult, { dispatch }) => {
    dispatch(openAlertModal({ title: payload.errorType, body: payload.message }));
  }
);

export const handleSSOAccountHandlerResult = createAppAsyncThunk(
  `signin/handleSSOAccountHandlerResult`,
  async (payload: SSOAccountHandlerResult) => {
    logger.info('handleSSOAccountHandlerResult', payload);
  }
);

export const resetDevice = createAppAsyncThunk(
  `signin/resetDevice`,
  async (_: undefined, { extra }) => {
    extra.onboardingBridge.resetDevice();
  }
);

export const startSSOProvision = createAppAsyncThunk(
  `signin/startSSOProvision`,
  async (payload: StartSSOProvisionPayload, { extra }) => {
    extra.onboardingBridge.startSSOProvision(payload);
  }
);

export const handleOnboardingSSOResult = createAppAsyncThunk(
  `signin/handleOnboardingSSOResult`,
  async (payload: OnboardingSSOResult, { dispatch }) => {
    logger.info('handleOnboardingSSOResult:', payload);
    if (payload.errorType === 'local_error') {
      dispatch(setCompanyIdErrorMsg(payload.message));
    } else if (payload.errorType == 'invalid_input') {
      dispatch(setRecoverYourAccountErrorMsg(payload.message));
    }
  }
);

export const resendATOCode = createAppAsyncThunk(
  `signin/resendATOCode`,
  async (_: undefined, { extra }) => {
    extra.onboardingBridge.resendATOCode();
  }
);

export const requestEmailATOCode = createAppAsyncThunk(
  `signin/requestEmailATOCode`,
  async (_: undefined, { extra }) => {
    extra.onboardingBridge.requestEmailATOCode();
  }
);

export const verifyMasterRecoveryKey = createAppAsyncThunk(
  `signin/verifyMasterRecoveryKey`,
  async (key: string, { extra }) => {
    extra.onboardingBridge.verifyMasterRecoveryKey(key);
  }
);

export const loadBootstrapFile = createAppAsyncThunk(
  `signin/loadBootstrapFile`,
  async (payload: LoadBootstrapFilePayload, { extra }) => {
    extra.onboardingBridge.loadBootstrapFile(payload);
  }
);

export const handleLoadBootstrapFileResult = createAppAsyncThunk(
  `signin/handleLoadBootstrapFileResult`,
  async (payload: LoadBootstrapFileResult, { extra }) => {
    if (payload.screen === 'agreeAndContinueEnterpriseScreen') {
      // TODO: build ui
      // https://code.amazon.com/packages/WickrDesktopApp/blobs/mainline/--/clients/enterprise/qml/AgreeAndContinueEnterprise.qml
    } else if (payload.screen === 'registrationNativeScreen') {
      // TODO: build ui
      // https://code.amazon.com/packages/WickrDesktopApp/blobs/mainline/--/clients/enterprise/qml/UserNativeRegistration.qml
    } else if (payload.screen === 'resetAndShowInitialScreen') {
      // we should probably do the resetting on qt side since i see it clears states in 2 helper classes and our reset fns do extra stuff which we dont want
      extra.navigate(generateSigninRoute.enterpriseConfigure());
    } else {
      // showLoginScreen
      extra.navigate(generateSigninRoute.enterpriseSignIn());
    }
  }
);

export const handleOnboardingPushDeviceSyncVerifyNewDevice = createAppAsyncThunk(
  `signin/handleOnboardingPushDeviceSyncVerifyNewDevice`,
  async (deviceVerifyKey: string, { dispatch }) => {
    dispatch(setSigninDeviceVerifyKey(deviceVerifyKey));
  }
);

export const requestDeviceInfo = createAppAsyncThunk(
  `signin/requestDeviceInfo`,
  async (_: undefined, { extra }) => {
    extra.onboardingBridge.requestDeviceInfo();
  }
);

export const startGuestSignUpFlow = createAppAsyncThunk(
  `signin/startGuestSignUpFlow`,
  async (_: undefined, { extra }) => {
    extra.onboardingBridge.startGuestSignUpFlow();
  }
);

export const showSaveFileDialog = createAppAsyncThunk(
  `signin/showSaveFileDialog`,
  async (_: undefined, { extra }) => {
    extra.onboardingBridge.showSaveFileDialog();
  }
);

export const continueRegisterNewUser = createAppAsyncThunk(
  `signin/continueRegisterNewUser`,
  async (_: undefined, { extra }) => {
    extra.onboardingBridge.continueRegisterNewUser();
  }
);

export const getRegions = createAppAsyncThunk(
  `signin/getRegions`,
  async (_: undefined, { extra }) => {
    const res = await extra.onboardingBridge.getRegions();
    return res;
  }
);

export const getSelectedRegionName = createAppAsyncThunk(
  `signin/getSelectedRegionName`,
  async (_: undefined, { extra }) => {
    const res = await extra.onboardingBridge.getSelectedRegionName();
    return res;
  }
);

export const selectRegion = createAppAsyncThunk(
  `signin/selectRegion`,
  async (payload: string, { extra }) => {
    extra.onboardingBridge.selectRegion(payload);
  }
);
