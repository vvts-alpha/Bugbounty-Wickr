import { ActiveDevice } from '../models';
import { selectIsAdmin, selectIsAwsNetwork } from '../slices/account';
import {
  setAppStage,
  ConvoListSortMode,
  TranslationLanguageCode,
  Theme,
  selectSetting,
  setSetting,
} from '../slices/settings';
import { createAppAsyncThunk } from '../utils';
import { ChangePresencePayload, UpdateAppPayload } from '@/apis/webChannel/BridgeWebChannel';
import { ConsentPopupConfig, NetworkBanner } from '@/apis/webChannel/EnvironmentManagerWebChannel';
import {
  LeaveNetworkPayload,
  adminControls,
  getActiveDevices,
  leaveNetwork,
} from '@/apis/webFetch';
import { EMOJI_MART_LOCAL_STORAGE_KEY } from '@/components/PreloadedEmojiPicker';
import { Logger } from '@/lib/logger';

const logger = new Logger('Settings');

export const fetchAppStage = createAppAsyncThunk(
  `settings/fetchAppStage`,
  async (_: undefined, { dispatch, extra }) => {
    const stage = await extra.wickrSettings.getAppStage();
    dispatch(setAppStage(stage));
  }
);

export const fetchAppProperties = createAppAsyncThunk(
  `settings/fetchAppProperties`,
  async (_: undefined, { dispatch, extra }) => {
    const isEnterprise = await extra.wickrSettings.getIsEnterprise();
    const isGovCloudEnabled = await extra.wickrSettings.getIsGovCloudEnabled();
    const isGovCloudAdcEnabled = await extra.wickrSettings.getIsGovCloudAdcEnabled();
    const isPro = await extra.wickrSettings.getIsPro();
    dispatch(setSetting('isEnterprise', isEnterprise));
    dispatch(setSetting('isGovCloudEnabled', isGovCloudEnabled));
    dispatch(setSetting('isGovCloudAdcEnabled', isGovCloudAdcEnabled));
    dispatch(setSetting('isPro', isPro));
    const appVersion = (await extra.bridge.getAppVersion()).version;
    dispatch(setSetting('appVersion', appVersion));
    const complianceBotKey = await extra.environmentMgr.complianceBotKey();
    dispatch(setSetting('complianceBotKey', complianceBotKey));
  }
);

/** Updates the markdownControlsVisible visible setting in state and local storage */
export const updateMarkdownControlsVisible = createAppAsyncThunk(
  `settings/setMarkdownControlsVisible`,
  async (isVisible: boolean, { dispatch, extra }) => {
    extra.storage.set('MarkdownControlsVisible', isVisible);
    dispatch(setSetting('markdownControlsVisible', isVisible));
  }
);

export const updateRecentEmojis = createAppAsyncThunk(
  `settings/updateRecentEmojis`,
  async (_, { extra }) => {
    const emojiMartFrequentlyUsed = localStorage.getItem(EMOJI_MART_LOCAL_STORAGE_KEY);
    if (emojiMartFrequentlyUsed) {
      extra.storage.set('EmojiMartFrequentlyUsed', emojiMartFrequentlyUsed);
    }
  }
);

/** Updates the convoListSortMode setting in state and local storage */
export const updateConvoListSortMode = createAppAsyncThunk(
  `settings/updateConvoListSortMode`,
  async (sortMode: ConvoListSortMode, { dispatch, extra }) => {
    extra.storage.set('ConvoListSortMode', sortMode);
    dispatch(setSetting('convoListSortMode', sortMode));
  }
);

export const updateConvoListWidth = createAppAsyncThunk(
  `settings/setConvoListWidth`,
  async (width: number, { dispatch, extra }) => {
    extra.storage.set('ConvoListWidth', width);
    dispatch(setSetting('convoListWidth', width));
  }
);

export const updateCombinedConvoList = createAppAsyncThunk(
  `settings/setDmConvoList`,
  async (payload: boolean, { dispatch, extra }) => {
    dispatch(setSetting('convosCombined', payload));
    // dmConvoList is the inverse of combined
    extra.wickrSettings.setDmConvoList(!payload);
  }
);

export const updateEnableNotifications = createAppAsyncThunk(
  `settings/setEnableNotifications`,
  async (payload: boolean, { dispatch, extra }) => {
    extra.wickrSettings.setEnableNotifications(payload);
    dispatch(setSetting('enableNotifications', payload));
  }
);

export const updateOnlyShow1To1Notifications = createAppAsyncThunk(
  `settings/setOnlyShow1To1Notifications`,
  async (payload: boolean, { dispatch, extra }) => {
    extra.wickrSettings.setOnlyShow1To1Notifications(payload);
    dispatch(setSetting('onlyShow1To1Notifications', payload));
  }
);

export const updateShowAnonymousNotifications = createAppAsyncThunk(
  `settings/setShowAnonymousNotifications`,
  async (payload: boolean, { dispatch, extra }) => {
    extra.wickrSettings.setShowAnonymousNotifications(payload);
    dispatch(setSetting('showAnonymousNotifications', payload));
  }
);

export const updateTypingIndicatorEnabled = createAppAsyncThunk(
  `settings/setIsTypingIndicatorEnabled`,
  async (payload: boolean, { dispatch, extra }) => {
    extra.wickrSettings.setTypingIndicatorEnabled(payload);
    dispatch(setSetting('isTypingIndicatorEnabled', payload));
  }
);

export const updateLinkPreviewsEnabled = createAppAsyncThunk(
  `settings/setLinkPreviewEnabled`,
  async (payload: boolean, { dispatch, extra }) => {
    extra.wickrSettings.setLinkPreviewsEnabled(payload);
    dispatch(setSetting('linkPreviewsEnabled', payload));
  }
);

export const updateIsAutoLockMessages = createAppAsyncThunk(
  `settings/setIsAutoLockMessages`,
  async (payload: boolean, { dispatch, extra }) => {
    extra.wickrSettings.setIsAutoLockMessages(payload);
    dispatch(setSetting('isAutoUnlockMessages', payload));
  }
);

export const updateDisplayMaps = createAppAsyncThunk(
  `settings/setDisplayMaps`,
  async (payload: boolean, { dispatch, extra }) => {
    extra.wickrSettings.setDisplayMaps(payload);
    dispatch(setSetting('displayMaps', payload));
  }
);

export const updateMapType = createAppAsyncThunk(
  `settings/setMapType`,
  async (payload: number, { dispatch, extra }) => {
    extra.wickrSettings.setMapType(payload);
    dispatch(setSetting('mapType', payload));
  }
);

export const updateZoomLevel = createAppAsyncThunk(
  `settings/setZoomLevel`,
  async (payload: number, { dispatch, extra }) => {
    extra.wickrSettings.setZoomLevel(payload);
    dispatch(setSetting('zoomLevel', payload));
  }
);

export const updateLoggingEnabled = createAppAsyncThunk(
  `settings/setLoggingEnabled`,
  async (payload: boolean, { dispatch, extra }) => {
    extra.wickrSettings.setLoggingEnabled(payload);
    dispatch(setSetting('loggingEnabled', payload));
  }
);

export const updateLoggingExtendedEnabled = createAppAsyncThunk(
  `settings/setLoggingExtendedEnabled`,
  async (payload: boolean, { dispatch, extra }) => {
    extra.wickrSettings.setLoggingExtendedEnabled(payload);
    dispatch(setSetting('loggingExtendedEnabled', payload));
  }
);

export const saveLogs = createAppAsyncThunk(
  `settings/saveLogs`,
  async (_: undefined, { extra }) => {
    extra.bridge.saveLogs();
  }
);

export const clearLogs = createAppAsyncThunk(
  `settings/clearLogs`,
  async (_: undefined, { extra }) => {
    extra.bridge.clearLogs();
  }
);

export const fetchActiveDevices = createAppAsyncThunk(
  `settings/fetchActiveDevices`,
  async (_: undefined, { dispatch }) => {
    const activeDevices = await getActiveDevices();
    dispatch(setSetting('activeDevices', activeDevices));
  }
);

export const updateMessagesRightSide = createAppAsyncThunk(
  `settings/setMessagesRightSide`,
  async (payload: boolean, { dispatch, extra }) => {
    extra.wickrSettings.setMessagesRightSide(payload);
    dispatch(setSetting('messagesRightSide', payload));
  }
);

export const updateIsEnableWOAProxy = createAppAsyncThunk(
  `settings/setIsEnableWOAProxy`,
  async (payload: boolean, { dispatch, extra }) => {
    extra.wickrSettings.setIsEnableWOAProxy(payload);
    extra.serverModel.setProxy(payload);
    dispatch(setSetting('isEnableWOAProxy', payload));
  }
);

export const updateAutoMsgResendEnabled = createAppAsyncThunk(
  `settings/setAutoMsgResendEnabled`,
  async (payload: boolean, { dispatch, extra }) => {
    extra.wickrSettings.setAutoMsgResendEnabled(payload);
    dispatch(setSetting('autoMsgResendEnabled', payload));
  }
);

export const updateAutoMsgResendPeriod = createAppAsyncThunk(
  `settings/setAutoMsgResendPeriod`,
  async (payload: number, { dispatch, extra }) => {
    extra.wickrSettings.setAutoMsgResendPeriod(payload);
    dispatch(setSetting('autoMsgResendPeriod', payload));
  }
);

export const updateIsTcpCalling = createAppAsyncThunk(
  `settings/setIsTcpCalling`,
  async (payload: boolean, { dispatch, extra }) => {
    extra.wickrSettings.setIsTcpCalling(payload);
    dispatch(setSetting('isTcpCalling', payload));
  }
);

export const updateHDVideo = createAppAsyncThunk(
  `settings/setHDVideo`,
  async (payload: boolean, { dispatch, extra }) => {
    extra.wickrSettings.setHDVideo(payload);
    dispatch(setSetting('HDVideo', payload));
  }
);

export const updateParticipantLeaveSound = createAppAsyncThunk(
  `settings/setParticipantLeaveSound`,
  async (payload: boolean, { dispatch, extra }) => {
    extra.wickrSettings.setParticipantLeaveSound(payload);
    dispatch(setSetting('participantLeaveSound', payload));
  }
);

export const suspendDevice = createAppAsyncThunk(
  `settings/suspendDevice`,
  async (payload: ActiveDevice, { extra }) => {
    await extra.bridge.suspendDevice(payload);
  }
);

export const addDevice = createAppAsyncThunk(
  `settings/addDevice`,
  async (_: undefined, { extra }) => {
    return extra.uiBridge.addDevice();
  }
);

export const updateNightlyBetaRing = createAppAsyncThunk(
  `settings/setNightlyBetaRing`,
  async (payload: boolean, { dispatch, extra }) => {
    extra.wickrSettings.setNightlyBetaRing(payload);
    dispatch(setSetting('nightlyBetaRing', payload));
  }
);

export const updatePopcornOverrideAddress = createAppAsyncThunk(
  `settings/setPopcornOverrideAddress`,
  async (payload: string, { dispatch, extra }) => {
    extra.wickrSettings.setPopcornOverrideAddress(payload);
    dispatch(setSetting('popcornOverrideAddress', payload));
  }
);

export const updateWebViewAddress = createAppAsyncThunk(
  `settings/setWebViewAddress`,
  async (payload: string, { dispatch, extra }) => {
    extra.wickrSettings.setWebViewAddress(payload);
    dispatch(setSetting('webViewAddress', payload));
  }
);

export const updateLoggingEmulateProduction = createAppAsyncThunk(
  `settings/setLoggingEmulateProduction`,
  async (payload: boolean, { dispatch, extra }) => {
    extra.wickrSettings.setLoggingEmulateProduction(payload);
    dispatch(setSetting('loggingEmulateProduction', payload));
  }
);

export const updateDeveloperLogging = createAppAsyncThunk(
  `settings/setDeveloperLogging`,
  async (payload: boolean, { dispatch, extra }) => {
    extra.wickrSettings.setDeveloperLogging(payload);
    dispatch(setSetting('developerLogging', payload));
  }
);

export const updateIsCallStatsEnabled = createAppAsyncThunk(
  `settings/setIsCallStatsEnabled`,
  async (payload: boolean, { dispatch, extra }) => {
    extra.wickrSettings.setIsCallStatsEnabled(payload);
    dispatch(setSetting('isCallStatsEnabled', payload));
  }
);

export const updateSwitchboardDiagnostics = createAppAsyncThunk(
  `settings/setSwitchboardDiagnostics`,
  async (payload: boolean, { dispatch, extra }) => {
    extra.wickrSettings.setSwitchboardDiagnostics(payload);
    dispatch(setSetting('switchboardDiagnostics', payload));
  }
);

export const updateSocksUDPCalling = createAppAsyncThunk(
  `settings/setSocksUDPCalling`,
  async (payload: boolean, { dispatch, extra }) => {
    extra.wickrSettings.setSocksUDPCalling(payload);
    dispatch(setSetting('socksUDPCalling', payload));
  }
);

export const updateIsCleanAttachmentsEnabled = createAppAsyncThunk(
  `settings/setIsCleanAttachmentsEnabled`,
  async (payload: boolean, { dispatch, extra }) => {
    extra.wickrSettings.setIsCleanAttachmentsEnabled(payload);
    dispatch(setSetting('isCleanAttachmentsEnabled', payload));
  }
);

export const updateUiLoggingEnabled = createAppAsyncThunk(
  `settings/updateUiLoggingEnabled`,
  async (payload: boolean, { dispatch, extra }) => {
    extra.wickrSettings.setUiLoggingEnabled(payload);
    dispatch(setSetting('uiLoggingEnabled', payload));
  }
);

export const updateScreenShareWindowExclusion = createAppAsyncThunk(
  `settings/setScreenShareWindowExclusion`,
  async (payload: boolean, { dispatch, extra }) => {
    extra.wickrSettings.setScreenShareWindowExclusion(payload);
    dispatch(setSetting('screenShareWindowExclusion', payload));
  }
);

export const updateIs2FAEnabled = createAppAsyncThunk(
  `settings/setIs2FAEnabled`,
  async (payload: boolean, { dispatch, extra }) => {
    extra.wickrSettings.setIs2FAEnabled(payload);
    dispatch(setSetting('is2FAEnabled', payload));
  }
);

export type SetTwoFAActivePayload = {
  flag: boolean;
  code: string;
};

export const update2FAActive = createAppAsyncThunk(
  `settings/set2FAEnabled`,
  async (payload: SetTwoFAActivePayload, { extra }) => {
    extra.wickrSettings.set2FAActive(payload.flag, payload.code);
  }
);

// TODO move to something like thunks/app when it is made
export const checkForUpdates = createAppAsyncThunk(
  `settings/checkForUpdates`,
  async (_: undefined, { extra }) => {
    extra.bridge.checkForUpdates();
  }
);

// TODO move to something like thunks/app when it is made
export const viewOpenSource = createAppAsyncThunk(
  `settings/viewOpenSource`,
  async (_: undefined, { extra }) => {
    extra.bridge.viewOpenSource();
  }
);

// TODO move to something like thunks/app when it is made
export const resetApp = createAppAsyncThunk(
  `settings/resetApp`,
  async (_: undefined, { extra }) => {
    extra.bridge.resetApp();
  }
);

// TODO move to something like thunks/app when it is made
export const uninstallApp = createAppAsyncThunk(
  `settings/uninstallApp`,
  async (_: undefined, { extra }) => {
    extra.bridge.uninstallApp();
  }
);

export const refreshConnection = createAppAsyncThunk(
  `settings/refreshConnection`,
  async (_: undefined, { extra }) => {
    const host = await extra.serverModel.getRandomServer();
    if (host.length === 0) {
      logger.error('NETWORK SERVER MODEL: Error, empty host');
      return;
    }
    logger.info('NETWORK SERVER MODEL: Network Refresh, changing server to: ', host);
    return extra.serverModel.selectServer(host, true);
  }
);

export const updateLanguageCode = createAppAsyncThunk(
  `settings/setLanguageCode`,
  async (payload: TranslationLanguageCode, { dispatch, extra }) => {
    dispatch(setSetting('languageCode', payload));
    extra.wickrSettings.setLanguageCode(payload);
  }
);

export const updateIsTranslationEnabled = createAppAsyncThunk(
  `settings/setIsTranslationEnabled`,
  async (payload: boolean, { dispatch, extra }) => {
    dispatch(setSetting('isTranslationEnabled', payload));
    extra.wickrSettings.setIsTranslationEnabled(payload);
  }
);

export const updateIsMetricsEnabled = createAppAsyncThunk(
  `settings/setIsMetricsEnabled`,
  async (payload: boolean, { dispatch, extra }) => {
    dispatch(setSetting('isMetricsEnabled', payload));
    extra.wickrSettings.setIsMetricsEnabled(payload);
  }
);

export const updatePresenceEnabled = createAppAsyncThunk(
  `settings/setPresenceEnabled`,
  async (payload: ChangePresencePayload, { extra }) => {
    extra.bridge.changePresence(payload);
  }
);

export const fetchIsGuardEnabled = createAppAsyncThunk(
  `settings/fetchIsGuardEnabled`,
  async (_: undefined, { dispatch, extra }) => {
    const result = await extra.bridge.isGuardEnabled();
    dispatch(setSetting('guardEnabled', result));
  }
);

export const updateTdfEnabled = createAppAsyncThunk(
  `settings/updateTdfEnabled`,
  async (_: undefined, { dispatch, extra }) => {
    const tdfEnabled = await extra.environmentMgr.getTdfEnabled();
    dispatch(setSetting('tdfEnabled', tdfEnabled));
  }
);

export const updateUseOpenGLES = createAppAsyncThunk(
  `settings/useOpenGLES`,
  async (payload: boolean, { dispatch, extra }) => {
    dispatch(setSetting('useOpenGLES', payload));
    extra.wickrSettings.setUseOpenGLES(payload);
  }
);

export const updateWinTextScaleFactor = createAppAsyncThunk(
  `settings/updateWinTextScaleFactor`,
  async (payload: number, { dispatch, extra }) => {
    dispatch(setSetting('winTextScaleFactor', payload));
    extra.wickrSettings.setWinTextScaleFactor(payload);
  }
);

export const attemptLeaveNetwork = createAppAsyncThunk(
  'settings/leaveNetwork',
  async (payload: LeaveNetworkPayload) => {
    if (!payload.password) return;
    return await leaveNetwork(payload.password);
  }
);

export const fetchIsAutoUpdateSupported = createAppAsyncThunk(
  'settings/isAutoUpdateSupported',
  async (_: undefined, { extra, dispatch }) => {
    const isAutoUpdateSupported = await extra.wickrSettings.getIsAutoUpdateSupported();
    dispatch(setSetting('isAutoUpdateSupported', isAutoUpdateSupported));
  }
);

export const openAdminControls = createAppAsyncThunk(
  `settings/adminControls`,
  async (_: undefined, { getState }) => {
    const isAdmin = selectIsAdmin(getState());
    const isAwsNetwork = selectIsAwsNetwork(getState());
    if (isAdmin && !isAwsNetwork) {
      return adminControls();
    }
  }
);

export const updateTheme = createAppAsyncThunk(
  `settings/updateTheme`,
  async (payload: Theme, { extra, dispatch }) => {
    extra.storage.set('Theme', payload);
    dispatch(setSetting('theme', payload));
  }
);

export const updateApp = createAppAsyncThunk(
  `settings/updateApp`,
  async (payload: UpdateAppPayload | undefined, { extra }) => {
    return extra.bridge.updateApp(payload);
  }
);

export const ignoreUpdate = createAppAsyncThunk(
  `settings/ignoreUpdate`,
  async (_: undefined, { extra }) => {
    return extra.bridge.ignoreUpdate();
  }
);

export const testCrashReporting = createAppAsyncThunk(
  `settings/testCrashReporting`,
  async (_: undefined, { extra }) => {
    return extra.bridge.testCrashReporting();
  }
);

export const testNetworkBanner = createAppAsyncThunk(
  `settings/testNetworkBanner`,
  async (payload: Partial<NetworkBanner>, { extra }) => {
    return extra.bridge.testNetworkBanner(payload);
  }
);

export const updateNetworkBannerConfig = createAppAsyncThunk(
  `settings/updateNetworkBannerConfig`,
  async (banner: NetworkBanner, { getState, dispatch }) => {
    const existingBanner = selectSetting(getState(), 'networkBannerConfig');

    if (
      existingBanner &&
      banner.versionId === existingBanner.versionId &&
      existingBanner.dismissed
    ) {
      logger.info('Network banner already dismissed', banner.versionId, banner.content);
      return;
    }

    dispatch(setSetting('networkBannerConfig', banner));
  }
);

export const updateConsentPopupConfig = createAppAsyncThunk(
  `settings/updateConsentPopupConfig`,
  async (config: ConsentPopupConfig, { dispatch, extra }) => {
    if (config?.content) {
      extra.uiBridge.closeAllPanels();
    }
    dispatch(setSetting('consentPopupConfig', config));
  }
);

export const acknowledgeConsentPopup = createAppAsyncThunk(
  `settings/acknowledgeConsentPopup`,
  async (_: undefined, { dispatch, extra }) => {
    return await extra.environmentMgr.clearConsentPopupConfig();
  }
);

export const updateAutoSummaryEnabled = createAppAsyncThunk(
  `settings/updateAutoSummaryEnabled`,
  async (enabled: boolean, { dispatch, extra }) => {
    extra.storage.set('AutoSummaryEnabled', enabled);
    dispatch(setSetting('autoSummaryEnabled', enabled));
  }
);

export const updateShowKnowledgeBaseOnlyChat = createAppAsyncThunk(
  `settings/updateShowKnowledgeBaseOnlyChat`,
  async (payload: boolean, { dispatch, extra }) => {
    extra.storage.set('ShowKnowledgeBaseOnlyChat', payload);
    dispatch(setSetting('showKnowledgeBaseOnlyChat', payload));
  }
);

export const setShowWebViewImmediately = createAppAsyncThunk(
  `settings/setShowWebViewImmediately`,
  async (payload: boolean, { dispatch, extra }) => {
    extra.wickrSettings.setShowWebViewImmediately(payload);
    dispatch(setSetting('showWebViewImmediately', payload));
  }
);

export const updateScreenSecurityEnabled = createAppAsyncThunk(
  `settings/updateScreenSecurityEnabled`,
  async (payload: boolean, { dispatch, extra }) => {
    dispatch(setSetting('screenSecurityEnabled', payload));
    extra.wickrSettings.setScreenSecurityEnabled(payload);
  }
);

export const updateDeveloperModeEnabled = createAppAsyncThunk(
  `settings/updateDeveloperModeEnabled`,
  async (payload: boolean, { dispatch, extra }) => {
    extra.storage.set('DeveloperModeEnabled', payload);
    dispatch(setSetting('developerModeEnabled', payload));
  }
);
