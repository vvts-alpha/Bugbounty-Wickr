import { useEffect } from 'react';
import { Logger } from '@/lib/logger';
import { useAppDispatch } from '@/store';
import { setSetting } from '@/store/slices/settings';
import { useWebChannel } from './context';

const logger = new Logger('WickrSettingsSubscriptions');

// Subscribes to settings signals/properties and connects the handlers
export const WickrSettingsSubscriptions = () => {
  const dispatch = useAppDispatch();
  const { wickrSettings } = useWebChannel();

  useEffect(() => {
    // ===========================================
    // Connect signals to handlers
    // ===========================================

    const unsubs: Array<() => void> = [
      wickrSettings.connectProperty('isAutoUnlockMessagesChanged', async () => {
        const value = await wickrSettings.getIsAutoUnlockMessages();
        logger.info('onIsAutoUnlockMessagesChanged', value);
        dispatch(setSetting('isAutoUnlockMessages', value));
      }),

      wickrSettings.connectProperty('messagesRightSideChanged', async () => {
        const value = await wickrSettings.getMessagesRightSide();
        logger.info('onMessagesRightSideChanged', value);
        dispatch(setSetting('messagesRightSide', value));
      }),

      wickrSettings.connectProperty('isTranslationEnabledChanged', async () => {
        const value = await wickrSettings.getIsTranslationEnabled();
        logger.info('onIsTranslationEnabledChanged', value);
        dispatch(setSetting('isTranslationEnabled', value));
      }),

      wickrSettings.connectProperty('isTranslationAvailableChanged', async () => {
        const value = await wickrSettings.getIsTranslationAvailable();
        logger.info('onIsTranslationAvailableChanged', value);
        dispatch(setSetting('isTranslationAvailable', value));
      }),

      wickrSettings.connectProperty('typingIndicatorChanged', async () => {
        const value = await wickrSettings.getTypingIndicator();
        logger.info('handleIsTypingIndicatorEnabledChanged', value);
        dispatch(setSetting('isTypingIndicatorEnabled', value));
      }),

      wickrSettings.connectProperty('dmConvoListChanged', async () => {
        // Beware, there is a signal called `combinedConvoList` but
        // the actual signal to listen to is `dmConvoList`.
        // our setting is the inverse of dmConvoList
        const value = await wickrSettings.getDmConvoList();
        logger.info('combinedConvoList', !value);
        dispatch(setSetting('convosCombined', !value));
      }),

      wickrSettings.connectProperty('enableNotificationsChanged', async () => {
        const value = await wickrSettings.getEnableNotifications();
        logger.info('enableNotificationsChanged', value);
        dispatch(setSetting('enableNotifications', value));
      }),

      wickrSettings.connectProperty('onlyShow1To1NotificationsChanged', async () => {
        const value = await wickrSettings.getOnlyShow1To1Notifications();
        logger.info('onlyShow1To1NotificationsNotificationsChanged', value);
        dispatch(setSetting('onlyShow1To1Notifications', value));
      }),

      wickrSettings.connectProperty('showAnonymousNotificationsChanged', async () => {
        const value = await wickrSettings.getShowAnonymousNotifications();
        logger.info('showAnonymousNotificationsChanged', value);
        dispatch(setSetting('showAnonymousNotifications', value));
      }),

      wickrSettings.connectProperty('linkPreviewsEnabledChanged', async () => {
        const value = await wickrSettings.getLinkPreviewsEnabled();
        logger.info('linkPreviewsEnabledChanged', value);
        dispatch(setSetting('linkPreviewsEnabled', value));
      }),

      wickrSettings.connectProperty('displayMapsChanged', async () => {
        const value = await wickrSettings.getDisplayMaps();
        logger.info('displayMapsChanged', value);
        dispatch(setSetting('displayMaps', value));
      }),

      wickrSettings.connectProperty('mapTypeChanged', async () => {
        const value = await wickrSettings.getMapType();
        logger.info('mapTypeChanged', value);
        dispatch(setSetting('mapType', value));
      }),

      wickrSettings.connectProperty('zoomLevelChanged', async () => {
        const value = await wickrSettings.getZoomLevel();
        logger.info('zoomLevelChanged', value);
        dispatch(setSetting('zoomLevel', value));
      }),

      wickrSettings.connectProperty('enableProxyChanged', async () => {
        const value = await wickrSettings.getIsEnableWOAProxy();
        logger.info('isEnableWOAProxyChanged', value);
        dispatch(setSetting('isEnableWOAProxy', value));
      }),

      wickrSettings.connectProperty('autoMsgResendEnabledChanged', async () => {
        const value = await wickrSettings.getAutoMsgResendEnabled();
        logger.info('autoMsgResendEnabledChanged', value);
        dispatch(setSetting('autoMsgResendEnabled', value));
      }),

      wickrSettings.connectProperty('autoMsgResendPeriodChanged', async () => {
        const value = await wickrSettings.getAutoMsgResendPeriod();
        logger.info('autoMsgResendPeriodChanged', value);
        dispatch(setSetting('autoMsgResendPeriod', value));
      }),

      wickrSettings.connectProperty('isTcpCallingChanged', async () => {
        const value = await wickrSettings.getIsTcpCalling();
        logger.info('isTcpCallingChanged', value);
        dispatch(setSetting('isTcpCalling', value));
      }),

      wickrSettings.connectProperty('HDVideoChanged', async () => {
        const value = await wickrSettings.getHDVideo();
        logger.info('HDVideoChanged', value);
        dispatch(setSetting('HDVideo', value));
      }),

      wickrSettings.connectProperty('participantLeaveSoundChanged', async () => {
        const value = await wickrSettings.getParticipantLeaveSound();
        logger.info('participantLeaveSoundChanged', value);
        dispatch(setSetting('participantLeaveSound', value));
      }),

      wickrSettings.connectProperty('nightlyBetaRingChanged', async () => {
        const value = await wickrSettings.getNightlyBetaRing();
        logger.info('nightlyBetaRingChanged', value);
        dispatch(setSetting('nightlyBetaRing', value));
      }),

      wickrSettings.connectProperty('popcornOverrideAddressChanged', async () => {
        const value = await wickrSettings.getPopcornOverrideAddress();
        logger.info('popcornOverrideAddressChanged', value);
        dispatch(setSetting('popcornOverrideAddress', value));
      }),

      wickrSettings.connectProperty('onLoggingEmulateProductionChanged', async () => {
        const value = await wickrSettings.getLoggingEmulateProduction();
        logger.info('loggingEmulateProduction', value);
        dispatch(setSetting('loggingEmulateProduction', value));
      }),

      wickrSettings.connectProperty('onLoggingEnabledChanged', async () => {
        const value = await wickrSettings.getLoggingEnabled();
        logger.info('loggingEnabledChanged', value);
        dispatch(setSetting('loggingEnabled', value));
      }),

      wickrSettings.connectProperty('onLoggingExtendedEnabledChanged', async () => {
        const value = await wickrSettings.getLoggingExtendedEnabled();
        logger.info('loggingExtendedEnabledChanged', value);
        dispatch(setSetting('loggingExtendedEnabled', value));
      }),

      wickrSettings.connectProperty('developerLoggingChanged', async () => {
        const value = await wickrSettings.getDeveloperLogging();
        logger.info('developerLogging', value);
        dispatch(setSetting('developerLogging', value));
      }),

      wickrSettings.connectProperty('uiLoggingEnabledChanged', async () => {
        const value = await wickrSettings.getUiLoggingEnabled();
        logger.info('uiLoggingEnabledChanged', value);
        dispatch(setSetting('uiLoggingEnabled', value));
      }),

      wickrSettings.connectProperty('enableCallStatsChanged', async () => {
        const value = await wickrSettings.getIsCallStatsEnabled();
        logger.info('isCallStatsEnabled', value);
        dispatch(setSetting('isCallStatsEnabled', value));
      }),

      wickrSettings.connectProperty('switchboardDiagnosticsChanged', async () => {
        const value = await wickrSettings.getSwitchboardDiagnostics();
        logger.info('switchboardDiagnostics', value);
        dispatch(setSetting('switchboardDiagnostics', value));
      }),

      wickrSettings.connectProperty('socksUDPCallingChanged', async () => {
        const value = await wickrSettings.getSocksUDPCalling();
        logger.info('socksUDPCalling', value);
        dispatch(setSetting('socksUDPCalling', value));
      }),

      wickrSettings.connectProperty('enableCleanAttachmentsChanged', async () => {
        const value = await wickrSettings.getIsCleanAttachmentsEnabled();
        logger.info('isCleanAttachmentsEnabledChanged', value);
        dispatch(setSetting('isCleanAttachmentsEnabled', value));
      }),

      wickrSettings.connectProperty('screenShareWindowExclusionChanged', async () => {
        const value = await wickrSettings.getScreenShareWindowExclusion();
        logger.info('screenShareWindowExclusionChanged', value);
        dispatch(setSetting('screenShareWindowExclusion', value));
      }),

      wickrSettings.connectProperty('ssoEnabledChanged', async () => {
        const value = await wickrSettings.getSsoEnabled();
        logger.info('ssoEnabled', value);
        dispatch(setSetting('ssoEnabled', value));
      }),

      wickrSettings.connectProperty('is2FAEnabledChanged', async () => {
        const value = await wickrSettings.getIs2FAEnabled();
        logger.info('is2FAEnabled', value);
        dispatch(setSetting('is2FAEnabled', value));
      }),

      wickrSettings.connectProperty('is2FAActiveChanged', async () => {
        const value = await wickrSettings.getIs2FAActive();
        logger.info('is2FAActive', value);
        dispatch(setSetting('is2FAActive', value));
      }),

      wickrSettings.connectProperty('isMetricsEnabledChanged', async () => {
        const value = await wickrSettings.getIsMetricsEnabled();
        logger.info('isMetricsEnabled', value);
        dispatch(setSetting('isMetricsEnabled', value));
      }),

      wickrSettings.connectProperty('isMetricsAvailableChanged', async () => {
        const value = await wickrSettings.getIsMetricsAvailable();
        logger.info('isMetricsAvailable', value);
        dispatch(setSetting('isMetricsAvailable', value));
      }),

      wickrSettings.connectProperty('presenceEnabledChanged', async () => {
        const value = await wickrSettings.getIsPresenceEnabled();
        logger.info('isPresenceEnabled', value);
        dispatch(setSetting('isPresenceEnabled', value));
      }),

      wickrSettings.connectProperty('enableChangePWChanged', async () => {
        const value = await wickrSettings.getEnableChangePW();
        logger.info('enableChangePW', value);
        dispatch(setSetting('enableChangePW', value));
      }),

      wickrSettings.connectProperty('useOpenGLESChanged', async () => {
        const value = await wickrSettings.getUseOpenGLES();
        logger.info('useOpenGLES', value);
        dispatch(setSetting('useOpenGLES', value));
      }),

      wickrSettings.connectProperty('winTextScaleFactorChanged', async () => {
        const value = await wickrSettings.getWinTextScaleFactor();
        logger.info('winTextScaleFactor', value);
        dispatch(setSetting('winTextScaleFactor', value));
      }),

      wickrSettings.connectProperty('languageCodeChanged', async () => {
        const value = await wickrSettings.getLanguageCode();
        logger.info('languageCodeChanged', value);
        dispatch(setSetting('languageCode', value));
      }),

      wickrSettings.connectProperty('fileManagerChanged', async () => {
        const value = await wickrSettings.getFileManager();
        logger.info('fileManager', value);
        dispatch(setSetting('fileManager', value));
      }),

      wickrSettings.connectProperty('webViewAddressChanged', async () => {
        const url = await wickrSettings.getWebViewAddress();
        logger.info('webViewAddressChanged', url);
        dispatch(setSetting('webViewAddress', url));
      }),

      wickrSettings.connectProperty('mlsEnabledChanged', async () => {
        const mlsEnabled = await wickrSettings.getMlsEnabled();
        const mlsMigrationEnabled = await wickrSettings.getMlsMigrationEnabled();
        const mlsGroupEnabled = await wickrSettings.getMlsGroupEnabled();
        const mlsDMEnabled = await wickrSettings.getMlsDMEnabled();
        logger.info(
          'mlsEnabledChanged:: mlsEnabled:',
          mlsEnabled,
          ', mlsMigrationEnabled:',
          mlsMigrationEnabled,
          ', mlsGroupEnabled',
          mlsGroupEnabled,
          ', mlsDMEnabled:',
          mlsDMEnabled
        );
        dispatch(setSetting('mlsEnabled', mlsEnabled));
        dispatch(setSetting('mlsMigrationEnabled', mlsMigrationEnabled));
        dispatch(setSetting('mlsGroupEnabled', mlsGroupEnabled));
        dispatch(setSetting('mlsDMEnabled', mlsDMEnabled));
      }),

      wickrSettings.connectProperty('mlsProtocolEnabledChanged', async () => {
        const value = await wickrSettings.getMlsProtocolEnabled();
        logger.info('mlsProtocolEnabledChanged', value);
        dispatch(setSetting('mlsProtocolEnabled', value));
      }),

      wickrSettings.connectProperty('screenSecurityEnabledChanged', async () => {
        const value = await wickrSettings.getScreenSecurityEnabled();
        logger.info('screenSecurityEnabledChanged', value);
        dispatch(setSetting('screenSecurityEnabled', value));
      }),

      wickrSettings.connectProperty('showWebViewImmediatelyChanged', async () => {
        const value = await wickrSettings.getShowWebViewImmediately();
        logger.info('showWebViewImmediatelyChanged', value);
        dispatch(setSetting('showWebViewImmediately', value));
      }),
    ];

    return () => unsubs.forEach((unsub) => unsub());
  }, [wickrSettings, dispatch]);

  return null;
};
