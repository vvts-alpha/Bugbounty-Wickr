import { NetworkBanner, ConsentPopupConfig } from '@/apis/webChannel/EnvironmentManagerWebChannel';
export type { ConsentPopupConfig } from '@/apis/webChannel/EnvironmentManagerWebChannel';
import { AppTranslationKey } from '@/lib/i18n';
import { ActiveDevice } from '@/store/models';

export type Theme = 'light-theme' | 'dark-theme' | 'classic-theme';

export function isValidTheme(theme: string): theme is Theme {
  return ['light-theme', 'dark-theme', 'classic-theme'].includes(theme);
}

export type SettingsState = EnvironmentManagerMap &
  WickrSettingsMap &
  ServerModelMap & {
    markdownControlsVisible: boolean; // True to show the compose box markdown controls, false to hide
    convoListSortMode: ConvoListSortMode; // Convo list sorting mode - either sort by most recent or name
    convoListWidth: number;
    theme: Theme;
  };

export type SettingName = keyof SettingsState;

export type ConvoListSortMode = 'recent' | 'name';
export type ShredderIntensity = 0 | 20 | 60 | 100;

// Full list of SDK env mgr types:
// https://quip-amazon.com/hzaCAFW8ODaB/Wickr-Desktop-SDK-Environment-Manager
type EnvironmentManagerMap = {
  locationEnabled: boolean;
  locationAllowMaps: boolean;
  filesEnabled: boolean;
  maxMessageTtl: number;
  maxMessageBOR: number;
  availableEnvelopeTTL: number[];
  availableEnvelopeBOR: number[];
  maxUploadSizeBytes: number;
  richProfileCardEnabled: boolean;
  typingIndicatorAllowedRemotely: boolean;
  allowLinkPreview: boolean;
  enableWOA: boolean;
  isComplianceConfigValid: boolean;
  complianceBotKey: string;
  presenceAllowed: boolean;
  canChangePassword: boolean;
  passwordHelp: string;
  passwordRegex: string;
  passwordMinLen: number;
  passwordLowercase: number;
  passwordUppercase: number;
  passwordNumbers: number;
  passwordSymbols: number;
  forceWOA: boolean;
  canLeaveNetwork: boolean;
  checkForUpdatesSetting: boolean; // Added "Setting" suffix to avoid confusion
  allowHybridView: boolean;
  shredderIntensity: ShredderIntensity;
  forceTcpCall: boolean;
  canStart11Call: boolean;
  canStartGroupCall: boolean;
  canStartRoomCall: boolean;
  enableFileDownload: boolean;
  messageForwardingEnabled: boolean;
  networkBannerConfig: NetworkBannerState;
  consentPopupConfig: ConsentPopupConfig;
  enableScreenCapture: boolean;
  enableNotificationSenderInfo: boolean;
  tdfEnabled: boolean;
};

type WickrSettingsMap = {
  enableBotButtonsInRooms: boolean;
  isAlpha: boolean;
  isAutoUnlockMessages: boolean;
  isBeta: boolean;
  isGamma: boolean;
  isProduction: boolean;
  isEnterprise: boolean;
  isGovCloudEnabled: boolean;
  isGovCloudAdcEnabled: boolean;
  isPro: boolean;
  appVersion: string;
  messagesRightSide: boolean;
  isTranslationEnabled: boolean;
  isTranslationAvailable: boolean;
  isTypingIndicatorEnabled: boolean;
  convosCombined: boolean; // True to show rooms, direct messages, and bots in a single group in the convo list
  enableNotifications: boolean;
  onlyShow1To1Notifications: boolean;
  showAnonymousNotifications: boolean;
  linkPreviewsEnabled: boolean;
  displayMaps: boolean;
  mapType: number;
  zoomLevel: number;
  loggingEnabled: boolean;
  loggingExtendedEnabled: boolean;
  activeDevices: ActiveDevice[];
  isEnableWOAProxy: boolean;
  autoMsgResendEnabled: boolean;
  autoMsgResendPeriod: number;
  isTcpCalling: boolean;
  HDVideo: boolean;
  participantLeaveSound: boolean;
  nightlyBetaRing: boolean;
  popcornOverrideAddress: string;
  webViewAddress: string;
  loggingEmulateProduction: boolean;
  developerLogging: boolean;
  isCallStatsEnabled: boolean;
  switchboardDiagnostics: boolean;
  socksUDPCalling: boolean;
  isCleanAttachmentsEnabled: boolean;
  uiLoggingEnabled: boolean;
  screenShareWindowExclusion: boolean;
  ssoEnabled: boolean;
  is2FAEnabled: boolean;
  is2FAActive: boolean;
  languageCode: TranslationLanguageCode;
  isMetricsEnabled: boolean;
  isMetricsAvailable: boolean;
  isPresenceEnabled: boolean;
  guardEnabled: boolean;
  enableChangePW: boolean;
  isServerConnected: boolean;
  useOpenGLES: boolean;
  winTextScaleFactor: number;
  mlsEnabled: boolean;
  mlsProtocolEnabled: boolean;
  mlsGroupEnabled: boolean;
  mlsDMEnabled: boolean;
  mlsMigrationEnabled: boolean;
  isAutoUpdateSupported: boolean;
  webView: boolean;
  updateAvailable: boolean;
  use12HourFormat: boolean;
  brandingLinks?: Brandinglinks;
  autoSummaryEnabled: boolean;
  showKnowledgeBaseOnlyChat: boolean;
  fileManager: boolean;
  screenSecurityEnabled: boolean;
  showWebViewImmediately: boolean;
  developerModeEnabled: boolean;
};

export enum ServerStatus {
  UNKNOWN = 0,
  AVAILABLE = 1,
  UNAVAILABLE = 2,
}

export type ServerModelMap = {
  isWOAProxyConfigured: boolean;
  currentHostStatus: ServerStatus;
};

export const TRANSLATION_LANGUAGE_MODEL = {
  af: 'Afrikaans',
  sq: 'Albanian',
  am: 'Amharic',
  hy: 'Armenian',
  az: 'Azerbaijani',
  bn: 'Bengali',
  bs: 'Bosnian',
  bg: 'Bulgarian',
  ca: 'Catalan',
  zh: 'Chinese (Simplified)',
  'zh-TW': 'Chinese (Traditional)',
  hr: 'Croatian',
  cs: 'Czech',
  da: 'Danish',
  nl: 'Dutch',
  en: 'English',
  et: 'Estonian',
  fi: 'Finnish',
  fr: 'French',
  'fr-CA': 'French (Canada)',
  ka: 'Georgian',
  de: 'German',
  el: 'Greek',
  gu: 'Gujarati',
  ht: 'Haitian Creole',
  hi: 'Hindi',
  hu: 'Hungarian',
  is: 'Icelandic',
  id: 'Indonesian',
  ga: 'Irish',
  it: 'Italian',
  ja: 'Japanese',
  kn: 'Kannada',
  kk: 'Kazakh',
  ko: 'Korean',
  lv: 'Latvian',
  lt: 'Lithuanian',
  mk: 'Macedonian',
  ms: 'Malay',
  ml: 'Malayalam',
  mt: 'Maltese',
  mr: 'Marathi',
  mn: 'Mongolian',
  no: 'Norwegian (Bokmål)',
  pl: 'Polish',
  pt: 'Portuguese (Brazil)',
  'pt-PT': 'Portuguese (Portugal)',
  pa: 'Punjabi',
  ro: 'Romanian',
  ru: 'Russian',
  sr: 'Serbian',
  si: 'Sinhala',
  sk: 'Slovak',
  sl: 'Slovenian',
  so: 'Somali',
  es: 'Spanish',
  'es-MX': 'Spanish (Mexico)',
  sw: 'Swahili',
  sv: 'Swedish',
  tl: 'Tagalog (Filipino)',
  ta: 'Tamil',
  te: 'Telugu',
  th: 'Thai',
  tr: 'Turkish',
  uk: 'Ukrainian',
  uz: 'Uzbek',
  vi: 'Vietnamese',
  cy: 'Welsh',
} satisfies { [code: string]: AppTranslationKey };

export type TranslationLanguageModel = typeof TRANSLATION_LANGUAGE_MODEL;

export type TranslationLanguageCode = keyof TranslationLanguageModel;

export function isTranslationLanguageCode(key: string): key is TranslationLanguageCode {
  return key in TRANSLATION_LANGUAGE_MODEL;
}

export type Brandinglinks = {
  complianceLearnMoreUrl: string;
  devicesyncLearnMoreUrl: string;
  downloadURL: string;
  faqURL: string;
  guestUsersLearnMoreUrl: string;
  keyboardShortcutInstructionsURL: string;
  legalURL: string;
  privacyPolicyURL: string;
  questionsURL: string;
  salesEmail: string;
  signupURL: string;
  supportURL: string;
  termsOfUseURL: string;
  verificationLearnMoreUrl: string;
  wickrPrivacyPolicyURL: string;
  wickrProducts: string;
  wickrTermsOfUseURL: string;
};

export type NetworkBannerState = NetworkBanner & {
  dismissed?: boolean;
};
