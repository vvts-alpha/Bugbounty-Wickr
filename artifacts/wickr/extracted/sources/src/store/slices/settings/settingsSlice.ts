import { PayloadAction, createSlice } from '@reduxjs/toolkit';
import { resetSlice } from '../shared';
import { AppStage } from '@/apis/webChannel/WickrSettingsWebChannel';
import { daysToMilliseconds } from '@/utils/date';
import {
  SettingsState,
  ServerStatus,
  NetworkBannerState,
  ConsentPopupConfig,
} from './settingsModels';

// This constant much be defined in this file. Imports cannot be used in the initial state.
export const DEFAULT_CONVO_LIST_WIDTH = 320;

const initialNetworkBanner: NetworkBannerState = {
  enabled: false,
  content: '',
  severity: 'info',
  dismissible: false,
  versionId: '',
  dismissed: false,
};

export const initialConsentPopupConfig: ConsentPopupConfig = {
  header: '',
  content: '',
  closeButtonLabel: '',
};

const initialState: SettingsState = {
  isAlpha: false,
  isBeta: false,
  isGamma: false,
  isProduction: true,
  isEnterprise: false,
  isGovCloudEnabled: false,
  isGovCloudAdcEnabled: false,
  isPro: false,
  appVersion: '',
  activeDevices: [],
  updateAvailable: false,
  use12HourFormat: true,

  /**
   * Settings persisted in local storage. Initialized via initializeSettings thunk
   */
  markdownControlsVisible: false,
  convoListSortMode: 'recent',
  convoListWidth: DEFAULT_CONVO_LIST_WIDTH,
  theme: 'light-theme', // TODO change the syncWithOS when it's working

  /**
   * Settings that users can control for their own client
   */
  isAutoUnlockMessages: false,
  messagesRightSide: true,
  isTranslationEnabled: false,
  isTranslationAvailable: false,
  // Default value reference: https://code.amazon.com/packages/WickrDesktopApp/blobs/fd53368862e3bf55129135fd7b8beb5edb3be88c/--/clients/enterprise/settings.cpp#L811
  isTypingIndicatorEnabled: true,
  convosCombined: false,
  enableNotifications: true,
  onlyShow1To1Notifications: false,
  showAnonymousNotifications: false,
  linkPreviewsEnabled: false,
  displayMaps: false,
  mapType: 0,
  zoomLevel: 18,
  loggingEnabled: false,
  loggingExtendedEnabled: false,
  isEnableWOAProxy: false,
  autoMsgResendEnabled: false,
  autoMsgResendPeriod: 10,
  isTcpCalling: false,
  HDVideo: false,
  participantLeaveSound: false,
  nightlyBetaRing: false,
  popcornOverrideAddress: '',
  webViewAddress: '',
  loggingEmulateProduction: false,
  developerLogging: false,
  isCallStatsEnabled: false,
  switchboardDiagnostics: false,
  socksUDPCalling: false,
  isCleanAttachmentsEnabled: false,
  uiLoggingEnabled: false,
  screenShareWindowExclusion: false,
  ssoEnabled: false,
  is2FAEnabled: false,
  is2FAActive: false,
  languageCode: 'en',
  isMetricsEnabled: false,
  isMetricsAvailable: false,
  isPresenceEnabled: false,
  enableChangePW: true,
  isServerConnected: false,
  useOpenGLES: false,
  winTextScaleFactor: 1,
  mlsEnabled: false,
  mlsProtocolEnabled: false,
  mlsDMEnabled: false,
  mlsGroupEnabled: false,
  checkForUpdatesSetting: false,
  isAutoUpdateSupported: false,
  webView: false,
  fileManager: false,
  screenSecurityEnabled: false,

  /**
   * Environment Manager Settings (Read-Only from Admin console)
   * Full list: https://quip-amazon.com/hzaCAFW8ODaB/Wickr-Desktop-SDK-Environment-Manager
   */
  locationEnabled: false,
  locationAllowMaps: false,
  filesEnabled: false,
  enableBotButtonsInRooms: false,
  richProfileCardEnabled: false,
  enableFileDownload: true,
  messageForwardingEnabled: false,
  networkBannerConfig: initialNetworkBanner,
  consentPopupConfig: initialConsentPopupConfig,
  // Default value reference: https://code.amazon.com/packages/WickrDesktopSDK/blobs/1d2e6ef1f50cd46eb2bada46c982726d27c07b3a/--/src/session/environmentmgr.cpp#L2643
  // There actually is a difference between MESSENGER and PRO/ENTERPRISE but in my testing the correct value will get set even if default is wrong
  maxMessageTtl: daysToMilliseconds(30),
  maxMessageBOR: 0,
  availableEnvelopeTTL: [],
  availableEnvelopeBOR: [],
  // Default value reference: https://code.amazon.com/packages/WickrDesktopApp/blobs/eee8ad7bfe15e31784d329f485ffa80f12325148/--/clients/enterprise/etc/permissions-cloud.json#L5
  maxUploadSizeBytes: 5_000_000,
  // Default values can be found here: https://code.amazon.com/packages/WickrDesktopSDK/blobs/mainline/--/src/session/environmentmgr.cpp
  typingIndicatorAllowedRemotely: false,
  allowLinkPreview: false,
  enableWOA: false,
  complianceBotKey: '',
  isComplianceConfigValid: false,
  presenceAllowed: false,
  guardEnabled: false,
  tdfEnabled: false,
  canChangePassword: true,
  passwordHelp: '',
  passwordRegex: '',
  passwordMinLen: 8,
  passwordLowercase: 0,
  passwordUppercase: 0,
  passwordNumbers: 0,
  passwordSymbols: 0,
  forceWOA: false,
  canLeaveNetwork: false,
  allowHybridView: false,
  shredderIntensity: 0,
  forceTcpCall: false,
  canStart11Call: false,
  canStartGroupCall: false,
  canStartRoomCall: false,
  mlsMigrationEnabled: false,
  autoSummaryEnabled: true,
  showKnowledgeBaseOnlyChat: false,
  enableScreenCapture: true,
  enableNotificationSenderInfo: true,

  // Server Model settings
  // Default values can be found here: https://code.amazon.com/packages/WickrDesktopApp/blobs/mainline/--/clients/enterprise/networkservermodel.cpp
  isWOAProxyConfigured: false,
  currentHostStatus: ServerStatus.UNKNOWN,
  brandingLinks: undefined,

  // Onboarding Bridge settings
  showWebViewImmediately: false,

  // Web-only settings persisted in local storage
  developerModeEnabled: false,
};

type SetSettingPayload<K extends keyof SettingsState> = {
  name: K;
  value: SettingsState[K];
};

export function setSetting<K extends keyof SettingsState>(name: K, value: SettingsState[K]) {
  return settingsSlice.actions.setSetting({ name, value });
}

export const settingsSlice = createSlice({
  name: 'settings',
  initialState,
  reducers: {
    // Use for all simple settings; only create a specific reducer when computing the next value
    setSetting: (state, { payload: { name, value } }: PayloadAction<SetSettingPayload<any>>) => {
      (state as any)[name] = value;
    },
    setAppStage: (state, { payload }: PayloadAction<AppStage>) => {
      state.isAlpha = payload === 'alpha';
      state.isBeta = payload === 'beta';
      state.isGamma = payload === 'gamma';
      state.isProduction = payload === 'production';
    },
    removeActiveDevice: (state, action: PayloadAction<number>) => {
      state.activeDevices = state.activeDevices.filter((device) => device.appId !== action.payload);
    },
  },
  extraReducers(builder) {
    builder.addCase(resetSlice, (state, { payload }) => {
      if (payload === 'settings' || payload === '*') {
        // don't reset nightlyBetaRing
        const { nightlyBetaRing } = state;
        return {
          ...initialState,
          nightlyBetaRing,
        };
      }
      return state;
    });
  },
});

export const settingsReducer = settingsSlice.reducer;

export const { setAppStage, removeActiveDevice } = settingsSlice.actions;
