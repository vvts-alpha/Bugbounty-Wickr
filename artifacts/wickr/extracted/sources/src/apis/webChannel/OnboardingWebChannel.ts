import { AppTranslationKey } from '@/lib/i18n';

export interface OnboardingWebChannel {
  // Methods
  determineInitialState: () => Promise<DeterimineInitialStateSettings>;
  checkUserExists: (email: string, isSignIn?: boolean, newSSOAccount?: boolean) => Promise<null>;
  verifyInviteCode: (email: string, inviteCode: string) => Promise<null>;
  registerWithPassword: (password: string) => Promise<null>;
  initiateLogin: (
    email: string,
    password: string,
    code?: string,
    callerLabel?: string,
    ssoAccessToken?: string,
    ssoRefreshToken?: string,
    ssoIdToken?: string,
    isMigration?: boolean
  ) => Promise<null>;
  resetPassword: (email: string) => Promise<null>;
  ssoAccountHandler: (email: string) => Promise<null>;
  resetDevice: () => Promise<null>;
  startSSOProvision: (email: string, companyId: string) => Promise<null>;
  resendATOCode: () => Promise<null>;
  requestEmailATOCode: () => Promise<null>;
  verifyMasterRecoveryKey: (key: string) => Promise<null>;
  ssoResetAccount: (companyID: string) => Promise<null>;
  loadBootstrapFile: (fileName: string, passPhrase: string) => Promise<null>;
  requestDeviceInfo: () => Promise<null>;
  startGuestSignUpFlow: () => Promise<null>;
  showSaveFileDialog: () => Promise<null>;
  continueRegisterNewUser: () => Promise<null>;
  getRegions: () => Promise<Region[]>;
  getSelectedRegionName: () => Promise<string>;
  selectRegion: (region: string) => Promise<void>;

  // Signals
  checkUserExistsResult: QSignal<[CheckUserExistsResult]>;
  onboardingPageChanged: QSignal<[OnboardingPageChangedResult]>;
  // --- verifyInviteCode signals
  onboardingUsernameExists: QSignal<[ErrorInfo]>;
  onboardingInvalidInviteCode: QSignal<[ErrorInfo]>;
  onboardingUsernameInvalid: QSignal<[ErrorInfo]>;
  // TODO: connect these error signals
  onboardingInvalidEmail: QSignal<[ErrorInfo]>;
  onboardingSendPhoneVerificationFailed: QSignal<[ErrorInfo]>;
  onboardingCheckEmailFailed: QSignal<[ErrorInfo]>;
  onboardingCloudBeginMultiRegionFailed: QSignal<[ErrorInfo]>;
  onboardingInternalBeginFailed: QSignal<[ErrorInfo]>;
  onboardingDummyStepFailed: QSignal<[ErrorInfo]>;
  // --- registerWithPassword signals
  passwordRegistrationError: QSignal<[string]>;
  processRegistrationResult: QSignal<[ProcessRegistrationResult]>;
  registerEnterpriseInvalidAtoCode: QSignal<[RegisterEnterpriseInvalidAtoCodeResult]>;
  // initiateLogin
  onboardingLoginResult: QSignal<[OnboardingLoginResult]>;
  // resetPassword
  checkEmailResult: QSignal<[CheckEmailResult]>;
  // ssoAccountHandler
  ssoAccountHandlerResult: QSignal<[SSOAccountHandlerResult]>;

  onboardingResetDeviceResult: QSignal<[OnboardingResetDeviceResult]>;
  // startSSOProvision
  onboardingSSOResult: QSignal<[OnboardingSSOResult]>;

  loadBootstrapFileResult: QSignal<[LoadBootstrapFileResult]>;
  onboardingPushDeviceSyncVerifyNewDevice: QSignal<[OnboardingPushDeviceSyncVerifyNewDeviceResult]>;
}

type InitialEnterpriseLoggedOutState = {
  isUserLoggedIn: false;
  isEnterprise: true;
  configFileOptionEnabled: true;
  configPath: string;
  awsWickrEnabled?: never;
};

type InitialAWSLoggedOutState = {
  isUserLoggedIn: false;
  awsWickrEnabled: boolean;
  isEnterprise?: never;
};

type InitialLoggedInState = {
  isUserLoggedIn: true;
  awsWickrEnabled: boolean;
  email: string;
  ssoEnabled: boolean;
};

export type DeterimineInitialStateSettings =
  | InitialEnterpriseLoggedOutState
  | InitialAWSLoggedOutState
  | InitialLoggedInState;

export type CheckUserExistsPayload = {
  email: string;
  isSignIn?: boolean;
  newSSOAccount?: boolean;
};

export enum OnboardState {
  SSOCompanyID = 2,
  NONSSOCheckYourEmail = 10,
  NONSSOPassword = 12,
}

export type CheckUserExistsResult = {
  success: boolean;
  onboardState?: OnboardState;
  isSSO?: boolean;
  isInvited?: boolean;
  message?: AppTranslationKey;
  errorCode?: string;
  showGuestSignup?: boolean;
  companyID?: string;
};

export enum OnboardingPage {
  EnterEmail = 0,
  VerifyEmail = 1,
  EnterPhone = 2, // TODO: check if needed
  VerifyPhone = 3, // TODO: check if needed
  EnterPassword = 4,
  AskJoinNetwork = 5,
  ScanQRCode = 6,
  MasterRecoveryKey = 7,
  NewUserAgreement = 8,
}

export type OnboardingPageChangedResult = {
  page: OnboardingPage;
  base32Key?: string;
  displayKey?: string;
  devAuthKey?: string;
};

export type VerifyInviteCodePayload = {
  email: string;
  inviteCode: string;
};

export type ProcessRegistrationResult =
  | ProxyAuthenticationRequiredError
  | ATOCodeRequired
  | SSOLoginRequired
  | ProcessRegistrationSuccess;

type ProxyAuthenticationRequiredError = {
  success: false;
  errorType: 'proxy_authentication_required';
  message: 'Proxy Authentication Required';
  proxyInfo: {
    userName: string;
    password: string;
  };
};

type ATOCodeRequired = {
  success: false;
  errorType: 'ato_required';
  message: 'ATO Code Required';
  screen: 'showATOEntryScreen';
  screenInfo: {
    userId: string;
    password: string;
  };
};

type SSOLoginRequired = {
  success: false;
  errorType: 'invalid_Login_should_be_sso_login';
  screen: 'showRegistrationSSOScreen';
  reset: true;
};

type BadSyncCredentials = {
  success: false;
  errorType: 'bad_sync_credentials';
  message: string;
};

type ProcessRegistrationSuccess = {
  success: true;
  wickrid: string;
  isSSO: boolean;
  isNewAccount: boolean;
  isNewDevice: boolean;
};

export type RegisterEnterpriseInvalidAtoCodeResult = {}; // always empty currently

type ErrorInfo = {
  errorCode?: string;
  title?: string;
  message: string;
};

export type InitiateLoginPayload = {
  email: string;
  password: string;
  code?: string;
  callerLabel?: string;
  ssoAccessToken?: string;
  ssoRefreshToken?: string;
  ssoIdToken?: string;
  isMigration?: boolean;
};

export type OnboardingLoginResult = {
  success: boolean;
  // show error msg
  errorCode?: string;
  errorMsg?: string;
  // error causes a page switch
  errorType?: string;
  screen?: string; // showLoginScreenWithOTP
  resetUI?: boolean;
};

export type CheckEmailResult = {
  success: boolean;
  errorType: string;
  message: string;
};

export type SSOAccountHandlerResult = {
  success: boolean;
  errorType: string;
  message: string;
};

export type OnboardingResetDeviceResult = {
  success: boolean;
  errorMsg: string;
};

export type OnboardingSSOResult = {
  success: boolean;
  errorType: string;
  message: AppTranslationKey;
  flow: string;
  status: string;
};

export type StartSSOProvisionPayload = {
  email: string;
  companyId: string;
};

export type LoadBootstrapFilePayload = {
  fileName: string;
  passPhrase: string;
};

export type LoadBootstrapFileResult = {
  screen:
    | 'agreeAndContinueEnterpriseScreen'
    | 'resetAndShowInitialScreen'
    | 'registrationNativeScreen'
    | 'showLoginScreen';
};

export type OnboardingPushDeviceSyncVerifyNewDeviceResult = {
  deviceVerifyKey: string;
};

export type Region = {
  displayName: string;
  endpoint: string;
  identifier: string;
  disabled: boolean;
};
