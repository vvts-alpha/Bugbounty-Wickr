import {
  CheckUserExistsPayload,
  InitiateLoginPayload,
  LoadBootstrapFilePayload,
  StartSSOProvisionPayload,
  VerifyInviteCodePayload,
} from './OnboardingWebChannel';
import { WebChannelAdapter } from './WebChannelAdapter';

export class OnboardingWebChannelAdapter extends WebChannelAdapter<'onboardingBridge'> {
  constructor() {
    super('onboardingBridge');
  }

  // ===========================================
  // Channel methods
  // ===========================================

  determineInitialState = async () => {
    const channel = await this.whenChannel();
    return channel.determineInitialState();
  };

  ssoAccountHandler = async (email: string) => {
    const channel = await this.whenChannel();
    return channel.ssoAccountHandler(email);
  };

  ssoResetAccount = async (companyID: string) => {
    const channel = await this.whenChannel();
    return channel.ssoResetAccount(companyID);
  };

  startGuestSignUpFlow = async () => {
    const channel = await this.whenChannel();
    return channel.startGuestSignUpFlow();
  };

  showSaveFileDialog = async () => {
    const channel = await this.whenChannel();
    return channel.showSaveFileDialog();
  };

  continueRegisterNewUser = async () => {
    const channel = await this.whenChannel();
    return channel.continueRegisterNewUser();
  };

  checkUserExists = async (payload: CheckUserExistsPayload) => {
    const channel = await this.whenChannel();
    return channel.checkUserExists(
      payload.email,
      payload.isSignIn ?? false,
      payload.newSSOAccount ?? false
    );
  };

  verifyInviteCode = async (payload: VerifyInviteCodePayload) => {
    const channel = await this.whenChannel();
    return channel.verifyInviteCode(payload.email, payload.inviteCode);
  };

  registerWithPassword = async (payload: string) => {
    const channel = await this.whenChannel();
    return channel.registerWithPassword(payload);
  };

  initiateLogin = async (payload: InitiateLoginPayload) => {
    const channel = await this.whenChannel();
    return channel.initiateLogin(
      payload.email,
      payload.password,
      payload.code,
      payload.callerLabel,
      payload.ssoAccessToken,
      payload.ssoRefreshToken,
      payload.ssoIdToken,
      payload.isMigration
    );
  };

  resetPassword = async (payload: string) => {
    const channel = await this.whenChannel();
    return channel.resetPassword(payload);
  };

  resetDevice = async () => {
    const channel = await this.whenChannel();
    return channel.resetDevice();
  };

  startSSOProvision = async (payload: StartSSOProvisionPayload) => {
    const channel = await this.whenChannel();
    return channel.startSSOProvision(payload.email, payload.companyId);
  };

  resendATOCode = async () => {
    const channel = await this.whenChannel();
    return channel.resendATOCode();
  };

  requestEmailATOCode = async () => {
    const channel = await this.whenChannel();
    return channel.requestEmailATOCode();
  };

  verifyMasterRecoveryKey = async (key: string) => {
    const channel = await this.whenChannel();
    return channel.verifyMasterRecoveryKey(key);
  };

  loadBootstrapFile = async (payload: LoadBootstrapFilePayload) => {
    const channel = await this.whenChannel();
    return channel.loadBootstrapFile(payload.fileName, payload.passPhrase);
  };

  requestDeviceInfo = async () => {
    const channel = await this.whenChannel();
    return channel.requestDeviceInfo();
  };

  getRegions = async () => {
    const channel = await this.whenChannel();
    return channel.getRegions();
  };

  getSelectedRegionName = async () => {
    const channel = await this.whenChannel();
    return channel.getSelectedRegionName();
  };

  selectRegion = async (region: string) => {
    const channel = await this.whenChannel();
    return channel.selectRegion(region);
  };
}
