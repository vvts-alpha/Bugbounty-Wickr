import { TranslationLanguageCode } from '@/store/slices/settings';
import { WebChannelAdapter } from './WebChannelAdapter';
import { AppStage } from './WickrSettingsWebChannel';

export class WickrSettingsWebChannelAdapter extends WebChannelAdapter<'wickrSettings'> {
  constructor() {
    super('wickrSettings');
  }

  // ===========================================
  // Channel methods
  // ===========================================

  getIsAlpha = async () => {
    const settings = await this.whenChannel();
    return settings.isAlpha;
  };

  getIsBeta = async () => {
    const settings = await this.whenChannel();
    return settings.isBeta;
  };

  getIsProduction = async () => {
    const settings = await this.whenChannel();
    return settings.isProduction;
  };

  getAppStage = async (): Promise<AppStage> => {
    const settings = await this.whenChannel();
    let stage: AppStage = 'production';
    if (settings.isAlpha) {
      stage = 'alpha';
    } else if (settings.isBeta) {
      stage = 'beta';
    } else if (settings.isGamma) {
      stage = 'gamma';
    }
    return stage;
  };

  getIsEnterprise = async () => {
    const settings = await this.whenChannel();
    return settings.isEnterprise;
  };

  getIsGovCloudEnabled = async () => {
    const settings = await this.whenChannel();
    return settings.isGovCloudEnabled;
  };

  getIsGovCloudAdcEnabled = async () => {
    const settings = await this.whenChannel();
    return settings.isGovCloudAdcEnabled;
  };

  getIsPro = async () => {
    const settings = await this.whenChannel();
    return settings.isPro;
  };

  getIsAutoUpdateSupported = async () => {
    const settings = await this.whenChannel();
    return settings.isAutoUpdateSupported;
  };

  getWebView = async () => {
    const settings = await this.whenChannel();
    return settings.webView;
  };

  getIsAutoUnlockMessages = async () => {
    const settings = await this.whenChannel();
    return settings.isAutoUnlockMessages;
  };

  getMessagesRightSide = async () => {
    const settings = await this.whenChannel();
    return settings.messagesRightSide;
  };

  getFileManager = async () => {
    const settings = await this.whenChannel();
    return settings.fileManager;
  };

  getIsTranslationEnabled = async () => {
    const settings = await this.whenChannel();
    return settings.isTranslationEnabled;
  };

  getIsTranslationAvailable = async () => {
    const settings = await this.whenChannel();
    return settings.isTranslationAvailable;
  };

  getTypingIndicator = async () => {
    const settings = await this.whenChannel();
    return settings.typingIndicator;
  };

  getDmConvoList = async () => {
    const settings = await this.whenChannel();
    return settings.dmConvoList;
  };

  getUISettings = async () => {
    const settings = await this.whenChannel();
    return settings.uiSettingsStore;
  };

  getEnableNotifications = async () => {
    const settings = await this.whenChannel();
    return settings.enableNotifications;
  };

  getOnlyShow1To1Notifications = async () => {
    const settings = await this.whenChannel();
    return settings.onlyShow1To1Notifications;
  };

  getShowAnonymousNotifications = async () => {
    const settings = await this.whenChannel();
    return settings.showAnonymousNotifications;
  };

  getLinkPreviewsEnabled = async () => {
    const settings = await this.whenChannel();
    return settings.linkPreviewsEnabled;
  };

  getDisplayMaps = async () => {
    const settings = await this.whenChannel();
    return settings.displayMaps;
  };

  getMapType = async () => {
    const settings = await this.whenChannel();
    return settings.mapType;
  };

  getZoomLevel = async () => {
    const settings = await this.whenChannel();
    return settings.zoomLevel;
  };

  getIsEnableWOAProxy = async () => {
    const settings = await this.whenChannel();
    return settings.isEnableWOAProxy;
  };

  getAutoMsgResendEnabled = async () => {
    const settings = await this.whenChannel();
    return settings.autoMsgResendEnabled;
  };

  getAutoMsgResendPeriod = async () => {
    const settings = await this.whenChannel();
    return settings.autoMsgResendPeriod;
  };

  getIsTcpCalling = async () => {
    const settings = await this.whenChannel();
    return settings.isTcpCalling;
  };

  getHDVideo = async () => {
    const settings = await this.whenChannel();
    return settings.HDVideo;
  };

  getParticipantLeaveSound = async () => {
    const settings = await this.whenChannel();
    return settings.participantLeaveSound;
  };

  getNightlyBetaRing = async () => {
    const settings = await this.whenChannel();
    return settings.nightlyBetaRing;
  };

  getPopcornOverrideAddress = async () => {
    const settings = await this.whenChannel();
    return settings.popcornOverrideAddress;
  };

  getWebViewAddress = async () => {
    const settings = await this.whenChannel();
    return settings.webViewAddress;
  };

  getLoggingEmulateProduction = async () => {
    const settings = await this.whenChannel();
    return settings.loggingEmulateProduction;
  };

  getLoggingEnabled = async () => {
    const settings = await this.whenChannel();
    return settings.loggingEnabled;
  };

  getLoggingExtendedEnabled = async () => {
    const settings = await this.whenChannel();
    return settings.loggingExtendedEnabled;
  };

  getDeveloperLogging = async () => {
    const settings = await this.whenChannel();
    return settings.developerLogging;
  };

  getUiLoggingEnabled = async () => {
    const settings = await this.whenChannel();
    return settings.uiLoggingEnabled;
  };

  getIsCallStatsEnabled = async () => {
    const settings = await this.whenChannel();
    return settings.isCallStatsEnabled;
  };

  getSwitchboardDiagnostics = async () => {
    const settings = await this.whenChannel();
    return settings.switchboardDiagnostics;
  };

  getSocksUDPCalling = async () => {
    const settings = await this.whenChannel();
    return settings.socksUDPCalling;
  };

  getIsCleanAttachmentsEnabled = async () => {
    const settings = await this.whenChannel();
    return settings.isCleanAttachmentsEnabled;
  };

  getScreenShareWindowExclusion = async () => {
    const settings = await this.whenChannel();
    return settings.screenShareWindowExclusion;
  };

  getSsoEnabled = async () => {
    const settings = await this.whenChannel();
    return settings.ssoEnabled;
  };

  getIs2FAEnabled = async () => {
    const settings = await this.whenChannel();
    return settings.is2FAEnabled;
  };

  getIs2FAActive = async () => {
    const settings = await this.whenChannel();
    return settings.is2FAActive;
  };

  getIsMetricsEnabled = async () => {
    const settings = await this.whenChannel();
    return settings.isMetricsEnabled;
  };

  getIsMetricsAvailable = async () => {
    const settings = await this.whenChannel();
    return settings.isMetricsAvailable;
  };

  getIsPresenceEnabled = async () => {
    const settings = await this.whenChannel();
    return settings.isPresenceEnabled;
  };

  getEnableChangePW = async () => {
    const settings = await this.whenChannel();
    return settings.enableChangePW;
  };

  getUseOpenGLES = async () => {
    const settings = await this.whenChannel();
    return settings.useOpenGLES;
  };

  getWinTextScaleFactor = async () => {
    const settings = await this.whenChannel();
    return settings.winTextScaleFactor;
  };

  getLanguageCode = async () => {
    const settings = await this.whenChannel();
    return settings.languageCode;
  };

  getMlsEnabled = async () => {
    const settings = await this.whenChannel();
    return settings.mlsEnabled;
  };

  getMlsMigrationEnabled = async () => {
    const settings = await this.whenChannel();
    return settings.mlsMigrationEnabled;
  };

  getMlsGroupEnabled = async () => {
    const settings = await this.whenChannel();
    return settings.mlsGroupEnabled;
  };

  getMlsDMEnabled = async () => {
    const settings = await this.whenChannel();
    return settings.mlsDMEnabled;
  };

  getMlsProtocolEnabled = async () => {
    const settings = await this.whenChannel();
    return settings.mlsProtocolEnabled;
  };

  getScreenSecurityEnabled = async () => {
    const settings = await this.whenChannel();
    return settings.screenSecurityEnabled;
  };

  getShowWebViewImmediately = async () => {
    const settings = await this.whenChannel();
    return settings.showWebViewImmediately;
  };

  setShowWebViewImmediately = async (payload: boolean) => {
    const settings = await this.whenChannel();
    settings.showWebViewImmediately = payload;
  };

  // Qt updates when we set uiSettingsStore directly (via a setter),
  // so we must update it wholesale
  setUISettings = async (newSettings: AnyObject) => {
    const settings = await this.whenChannel();
    settings.uiSettingsStore = newSettings;
  };

  setDmConvoList = async (payload: boolean) => {
    const settings = await this.whenChannel();
    settings.dmConvoList = payload;
  };

  setEnableNotifications = async (payload: boolean) => {
    const settings = await this.whenChannel();
    settings.enableNotifications = payload;
  };

  setOnlyShow1To1Notifications = async (payload: boolean) => {
    const settings = await this.whenChannel();
    settings.onlyShow1To1Notifications = payload;
  };

  setShowAnonymousNotifications = async (payload: boolean) => {
    const settings = await this.whenChannel();
    settings.showAnonymousNotifications = payload;
  };

  setTypingIndicatorEnabled = async (payload: boolean) => {
    const settings = await this.whenChannel();
    settings.typingIndicator = payload;
  };

  setLinkPreviewsEnabled = async (payload: boolean) => {
    const settings = await this.whenChannel();
    settings.linkPreviewsEnabled = payload;
  };

  setIsAutoLockMessages = async (payload: boolean) => {
    const settings = await this.whenChannel();
    settings.isAutoUnlockMessages = payload;
  };

  setDisplayMaps = async (payload: boolean) => {
    const settings = await this.whenChannel();
    settings.displayMaps = payload;
  };

  setMapType = async (payload: number) => {
    const settings = await this.whenChannel();
    settings.mapType = payload;
  };

  setZoomLevel = async (payload: number) => {
    const settings = await this.whenChannel();
    settings.zoomLevel = payload;
  };

  setLoggingEnabled = async (payload: boolean) => {
    const settings = await this.whenChannel();
    settings.loggingEnabled = payload;
  };

  setLoggingExtendedEnabled = async (payload: boolean) => {
    const settings = await this.whenChannel();
    settings.loggingExtendedEnabled = payload;
  };

  setMessagesRightSide = async (payload: boolean) => {
    const settings = await this.whenChannel();
    settings.messagesRightSide = payload;
  };

  setIsEnableWOAProxy = async (payload: boolean) => {
    const settings = await this.whenChannel();
    settings.isEnableWOAProxy = payload;
  };

  setAutoMsgResendEnabled = async (payload: boolean) => {
    const settings = await this.whenChannel();
    settings.autoMsgResendEnabled = payload;
  };

  setAutoMsgResendPeriod = async (payload: number) => {
    const settings = await this.whenChannel();
    settings.autoMsgResendPeriod = payload;
  };

  setIsTcpCalling = async (payload: boolean) => {
    const settings = await this.whenChannel();
    settings.isTcpCalling = payload;
  };

  setHDVideo = async (payload: boolean) => {
    const settings = await this.whenChannel();
    settings.HDVideo = payload;
  };

  setParticipantLeaveSound = async (payload: boolean) => {
    const settings = await this.whenChannel();
    settings.participantLeaveSound = payload;
  };

  setNightlyBetaRing = async (payload: boolean) => {
    const settings = await this.whenChannel();
    settings.nightlyBetaRing = payload;
  };

  setPopcornOverrideAddress = async (payload: string) => {
    const settings = await this.whenChannel();
    settings.popcornOverrideAddress = payload;
  };

  setWebViewAddress = async (payload: string) => {
    const settings = await this.whenChannel();
    settings.webViewAddress = payload;
  };

  setLoggingEmulateProduction = async (payload: boolean) => {
    const settings = await this.whenChannel();
    settings.loggingEmulateProduction = payload;
  };

  setDeveloperLogging = async (payload: boolean) => {
    const settings = await this.whenChannel();
    settings.developerLogging = payload;
  };

  setIsCallStatsEnabled = async (payload: boolean) => {
    const settings = await this.whenChannel();
    settings.isCallStatsEnabled = payload;
  };

  setSwitchboardDiagnostics = async (payload: boolean) => {
    const settings = await this.whenChannel();
    settings.switchboardDiagnostics = payload;
  };

  setSocksUDPCalling = async (payload: boolean) => {
    const settings = await this.whenChannel();
    settings.socksUDPCalling = payload;
  };

  setIsCleanAttachmentsEnabled = async (payload: boolean) => {
    const settings = await this.whenChannel();
    settings.isCleanAttachmentsEnabled = payload;
  };

  setUiLoggingEnabled = async (payload: boolean) => {
    const settings = await this.whenChannel();
    settings.uiLoggingEnabled = payload;
  };

  setScreenShareWindowExclusion = async (payload: boolean) => {
    const settings = await this.whenChannel();
    settings.screenShareWindowExclusion = payload;
  };

  setIs2FAEnabled = async (payload: boolean) => {
    const settings = await this.whenChannel();
    settings.is2FAEnabled = payload;
  };

  set2FAActive = async (flag: boolean, code: string) => {
    const settings = await this.whenChannel();
    settings.set2FAActive(flag, code);
  };

  setLanguageCode = async (payload: TranslationLanguageCode) => {
    const settings = await this.whenChannel();
    settings.languageCode = payload;
  };

  setIsTranslationEnabled = async (payload: boolean) => {
    const settings = await this.whenChannel();
    settings.isTranslationEnabled = payload;
  };

  setIsMetricsEnabled = async (payload: boolean) => {
    const settings = await this.whenChannel();
    settings.isMetricsEnabled = payload;
  };

  setUseOpenGLES = async (payload: boolean) => {
    const settings = await this.whenChannel();
    settings.useOpenGLES = payload;
  };

  setWinTextScaleFactor = async (payload: number) => {
    const settings = await this.whenChannel();
    settings.winTextScaleFactor = payload;
  };

  setScreenSecurityEnabled = async (payload: boolean) => {
    const settings = await this.whenChannel();
    settings.screenSecurityEnabled = payload;
  };
}
