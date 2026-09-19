import { WebChannelAdapter } from './WebChannelAdapter';

export class EnvironmentManagerWebChannelAdapter extends WebChannelAdapter<'environmentMgr'> {
  constructor() {
    super('environmentMgr');
  }

  // ===========================================
  // Channel methods
  // ===========================================
  complianceBotKey = async () => {
    const channel = await this.whenChannel();
    return channel.complianceBotKey();
  };

  clearConsentPopupConfig = async () => {
    const channel = await this.whenChannel();
    return channel.clearConsentPopupConfig();
  };

  getLocationEnabled = async () => {
    const channel = await this.whenChannel();
    return channel.locationEnabled;
  };

  getLocationAllowMaps = async () => {
    const channel = await this.whenChannel();
    return channel.locationAllowMaps;
  };

  getFilesEnabled = async () => {
    const channel = await this.whenChannel();
    return channel.filesEnabled;
  };

  getMaxUploadSize = async () => {
    const channel = await this.whenChannel();
    return channel.maxUploadSize;
  };

  getEnableFileDownload = async () => {
    const channel = await this.whenChannel();
    return channel.enableFileDownload;
  };

  getEnableBotButtonsInRooms = async () => {
    const channel = await this.whenChannel();
    return channel.enableBotButtonsInRooms;
  };

  getMaxMessageTTL = async () => {
    const channel = await this.whenChannel();
    return channel.maxMessageTTL;
  };

  getMaxMessageBOR = async () => {
    const channel = await this.whenChannel();
    return channel.maxMessageBOR;
  };

  getAvailableEnvelopeBOR = async () => {
    const channel = await this.whenChannel();
    return channel.availableEnvelopeBOR;
  };

  getAvailableEnvelopeTTL = async () => {
    const channel = await this.whenChannel();
    return channel.availableEnvelopeTTL;
  };

  getEnableRichProfileCard = async () => {
    const channel = await this.whenChannel();
    return channel.enableRichProfileCard;
  };

  getPresenceAllowed = async () => {
    const channel = await this.whenChannel();
    return channel.presenceAllowed;
  };

  getTypingIndicatorAllowedRemotely = async () => {
    const channel = await this.whenChannel();
    return channel.typingIndicatorAllowedRemotely;
  };

  getAllowLinkPreview = async () => {
    const channel = await this.whenChannel();
    return channel.allowLinkPreview;
  };

  getMessageForwardingEnabled = async () => {
    const channel = await this.whenChannel();
    return channel.messageForwardingEnabled;
  };

  getEnableWOA = async () => {
    const channel = await this.whenChannel();
    return channel.enableWOA;
  };

  getForceWOA = async () => {
    const channel = await this.whenChannel();
    return channel.forceWOA;
  };

  getIsComplianceConfigValid = async () => {
    const channel = await this.whenChannel();
    return channel.isComplianceConfigValid;
  };

  getCanChangePassword = async () => {
    const channel = await this.whenChannel();
    return channel.canChangePassword;
  };

  getPasswordHelp = async () => {
    const channel = await this.whenChannel();
    return channel.passwordHelp;
  };

  getPasswordRegex = async () => {
    const channel = await this.whenChannel();
    return channel.passwordRegex;
  };

  getPasswordMinLen = async () => {
    const channel = await this.whenChannel();
    return channel.passwordMinLen;
  };

  getPasswordLowercase = async () => {
    const channel = await this.whenChannel();
    return channel.passwordLowercase;
  };

  getPasswordUppercase = async () => {
    const channel = await this.whenChannel();
    return channel.passwordUppercase;
  };

  getPasswordNumbers = async () => {
    const channel = await this.whenChannel();
    return channel.passwordNumbers;
  };

  getPasswordSymbols = async () => {
    const channel = await this.whenChannel();
    return channel.passwordSymbols;
  };

  getForceTcpCall = async () => {
    const channel = await this.whenChannel();
    return channel.forceTcpCall;
  };

  getCanStart11Call = async () => {
    const channel = await this.whenChannel();
    return channel.canStart11Call;
  };

  getCanStartGroupCall = async () => {
    const channel = await this.whenChannel();
    return channel.canStartGroupCall;
  };

  getCanStartRoomCall = async () => {
    const channel = await this.whenChannel();
    return channel.canStartRoomCall;
  };

  getCanLeaveNetwork = async () => {
    const channel = await this.whenChannel();
    return channel.canLeaveNetwork;
  };

  getNetworkBannerConfig = async () => {
    const channel = await this.whenChannel();
    return channel.networkBannerConfig;
  };

  getConsentPopupConfig = async () => {
    const channel = await this.whenChannel();
    return channel.consentPopupConfig;
  };

  getCheckForUpdates = async () => {
    const channel = await this.whenChannel();
    return channel.checkForUpdates;
  };

  getAllowHybridView = async () => {
    const channel = await this.whenChannel();
    return channel.allowHybridView;
  };

  getShredderIntensity = async () => {
    const channel = await this.whenChannel();
    return channel.shredderIntensity;
  };

  getEnableScreenCapture = async () => {
    const channel = await this.whenChannel();
    return channel.enableScreenCapture;
  };

  getEnableNotificationSenderInfo = async () => {
    const channel = await this.whenChannel();
    return channel.enableNotificationSenderInfo;
  };

  getTdfEnabled = async () => {
    const channel = await this.whenChannel();
    return channel.tdfEnabled;
  };

  getSessionExpiresAt = async () => {
    const channel = await this.whenChannel();
    return channel.sessionExpiresAt;
  };

  getSessionFirstWarningSeconds = async () => {
    const channel = await this.whenChannel();
    return channel.sessionFirstWarningSeconds;
  };

  getSessionSecondWarningSeconds = async () => {
    const channel = await this.whenChannel();
    return channel.sessionSecondWarningSeconds;
  };
}
