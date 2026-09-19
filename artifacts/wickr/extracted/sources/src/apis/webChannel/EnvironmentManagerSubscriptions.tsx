import { secondsToMilliseconds } from 'date-fns';
import { useEffect } from 'react';
import { Logger } from '@/lib/logger';
import { useAppDispatch } from '@/store';
import { setShowSessionTimeoutMenuItem } from '@/store/slices/session';
import { setSetting } from '@/store/slices/settings';
import { openModal } from '@/store/thunks/modals';
import { updateSessionExpiresAt } from '@/store/thunks/session';
import { updateConsentPopupConfig, updateNetworkBannerConfig } from '@/store/thunks/settings';
import { closeAllQmlPanels } from '@/store/thunks/ui';
import { useWebChannel } from './context';

const logger = new Logger('EnvironmentManagerSubscriptions');

// Subscribes to environment manager signals/properties and connects the handlers
export const EnvironmentManagerSubscriptions = () => {
  const { environmentMgr } = useWebChannel();
  const dispatch = useAppDispatch();

  useEffect(() => {
    // ===========================================
    // Connect signals to handlers
    // ===========================================

    const unsubs: Array<() => void> = [
      environmentMgr.connectProperty('onLocationEnabledChanged', async () => {
        const locationEnabled = await environmentMgr.getLocationEnabled();
        logger.debug('onLocationEnabledChanged', locationEnabled);
        dispatch(setSetting('locationEnabled', locationEnabled));
      }),

      environmentMgr.connectProperty('onLocationAllowMapsChanged', async () => {
        const locationAllowMaps = await environmentMgr.getLocationAllowMaps();
        logger.debug('onLocationAllowMapsChanged', locationAllowMaps);
        dispatch(setSetting('locationAllowMaps', locationAllowMaps));
      }),

      environmentMgr.connectProperty('onFilesEnabledChanged', async () => {
        const filesEnabled = await environmentMgr.getFilesEnabled();
        logger.debug('onFilesEnabledChanged', filesEnabled);
        dispatch(setSetting('filesEnabled', filesEnabled));
      }),

      environmentMgr.connectProperty('onEnableBotButtonsInRoomsChanged', async () => {
        const enableBotButtonsInRooms = await environmentMgr.getEnableBotButtonsInRooms();
        logger.debug('onEnableBotButtonsInRoomsChanged', enableBotButtonsInRooms);
        dispatch(setSetting('enableBotButtonsInRooms', enableBotButtonsInRooms));
      }),

      environmentMgr.connectProperty('onMaxMessageTTLChanged', async () => {
        const maxMessageTTL = await environmentMgr.getMaxMessageTTL();
        const maxMessageTtl = secondsToMilliseconds(maxMessageTTL);
        logger.debug('onMaxMessageTTLChanged', maxMessageTtl);
        dispatch(setSetting('maxMessageTtl', maxMessageTtl));
      }),

      environmentMgr.connectProperty('onMaxMessageBORChanged', async () => {
        const maxMessageBORSeconds = await environmentMgr.getMaxMessageBOR();
        const maxMessageBOR = secondsToMilliseconds(maxMessageBORSeconds);
        dispatch(setSetting('maxMessageBOR', maxMessageBOR));
      }),

      environmentMgr.connectProperty('onAvailableEnvelopeBORChanged', async () => {
        const availableEnvelopeBORSeconds = await environmentMgr.getAvailableEnvelopeBOR();
        const availableEnvelopeBOR = availableEnvelopeBORSeconds.map(secondsToMilliseconds);
        dispatch(setSetting('availableEnvelopeBOR', availableEnvelopeBOR));
      }),

      environmentMgr.connectProperty('onAvailableEnvelopeTTLChanged', async () => {
        const availableEnvelopeTTLSeconds = await environmentMgr.getAvailableEnvelopeTTL();
        const availableEnvelopeTTL = availableEnvelopeTTLSeconds.map(secondsToMilliseconds);
        dispatch(setSetting('availableEnvelopeTTL', availableEnvelopeTTL));
      }),

      environmentMgr.connectProperty('signalMaxUploadSizeChanged', async () => {
        const maxUploadSize = await environmentMgr.getMaxUploadSize();
        logger.debug('onMaxUploadSizeChanged', maxUploadSize);
        dispatch(setSetting('maxUploadSizeBytes', maxUploadSize));
      }),

      environmentMgr.connectProperty('onEnableRichProfileCardChanged', async () => {
        const enableRichProfileCard = await environmentMgr.getEnableRichProfileCard();
        logger.debug('onEnableRichProfileCardChanged', enableRichProfileCard);
        dispatch(setSetting('richProfileCardEnabled', enableRichProfileCard));
      }),

      environmentMgr.connectProperty('signalTypingIndicatorAllowedRemotely', async () => {
        const typingIndicatorAllowedRemotely =
          await environmentMgr.getTypingIndicatorAllowedRemotely();
        logger.info('typingIndicatorAllowedRemotely', typingIndicatorAllowedRemotely);
        dispatch(setSetting('typingIndicatorAllowedRemotely', typingIndicatorAllowedRemotely));
      }),

      environmentMgr.connectProperty('signalAllowLinkPreviewChanged', async () => {
        const allowLinkPreview = await environmentMgr.getAllowLinkPreview();
        logger.info('allowLinkPreview', allowLinkPreview);
        dispatch(setSetting('allowLinkPreview', allowLinkPreview));
      }),

      environmentMgr.connectProperty('onEnableWOAChanged', async () => {
        const enableWOA = await environmentMgr.getEnableWOA();
        logger.info('enableWOA', enableWOA);
        dispatch(setSetting('enableWOA', enableWOA));
      }),

      environmentMgr.connectProperty('signalComplianceConfigValidChanged', async () => {
        const isComplianceConfigValid = await environmentMgr.getIsComplianceConfigValid();
        logger.info('isComplianceConfigValid', isComplianceConfigValid);
        dispatch(setSetting('isComplianceConfigValid', isComplianceConfigValid));
      }),

      environmentMgr.connectProperty('onPresenceAllowedChanged', async () => {
        const presenceAllowed = await environmentMgr.getPresenceAllowed();
        logger.info('presenceAllowed', presenceAllowed);
        dispatch(setSetting('presenceAllowed', presenceAllowed));
      }),

      environmentMgr.connectProperty('onCanChangePasswordChanged', async () => {
        const canChangePassword = await environmentMgr.getCanChangePassword();
        logger.info('canChangePassword', canChangePassword);
        dispatch(setSetting('canChangePassword', canChangePassword));
      }),

      environmentMgr.connectProperty('onPasswordHelp', async () => {
        const passwordHelp = await environmentMgr.getPasswordHelp();
        logger.info('passwordHelp', passwordHelp);
        dispatch(setSetting('passwordHelp', passwordHelp));
      }),

      environmentMgr.connectProperty('onPasswordRegex', async () => {
        const passwordRegex = await environmentMgr.getPasswordRegex();
        logger.info('passwordRegex', passwordRegex);
        dispatch(setSetting('passwordRegex', passwordRegex));
      }),

      environmentMgr.connectProperty('onPasswordMinLen', async () => {
        const passwordMinLen = await environmentMgr.getPasswordMinLen();
        logger.info('passwordMinLen', passwordMinLen);
        dispatch(setSetting('passwordMinLen', passwordMinLen));
      }),

      environmentMgr.connectProperty('onPasswordLowercase', async () => {
        const passwordLowercase = await environmentMgr.getPasswordLowercase();
        logger.info('passwordLowercase', passwordLowercase);
        dispatch(setSetting('passwordLowercase', passwordLowercase));
      }),

      environmentMgr.connectProperty('onPasswordUppercase', async () => {
        const passwordUppercase = await environmentMgr.getPasswordUppercase();
        logger.info('passwordUppercase', passwordUppercase);
        dispatch(setSetting('passwordUppercase', passwordUppercase));
      }),

      environmentMgr.connectProperty('onPasswordNumbers', async () => {
        const passwordNumbers = await environmentMgr.getPasswordNumbers();
        logger.info('passwordNumbers', passwordNumbers);
        dispatch(setSetting('passwordNumbers', passwordNumbers));
      }),

      environmentMgr.connectProperty('onPasswordSymbols', async () => {
        const passwordSymbols = await environmentMgr.getPasswordSymbols();
        logger.info('passwordSymbols', passwordSymbols);
        dispatch(setSetting('passwordSymbols', passwordSymbols));
      }),

      environmentMgr.connectProperty('onForceWOAChanged', async () => {
        const forceWOA = await environmentMgr.getForceWOA();
        logger.info('forceWOA, ', forceWOA);
        dispatch(setSetting('forceWOA', forceWOA));
      }),

      environmentMgr.connectProperty('signalForceTcpCallChanged', async () => {
        const forceTcpCall = await environmentMgr.getForceTcpCall();
        logger.info('forceTcpCall, ', forceTcpCall);
        dispatch(setSetting('forceTcpCall', forceTcpCall));
      }),

      environmentMgr.connectProperty('onCanLeaveNetworkChanged', async () => {
        const canLeaveNetwork = await environmentMgr.getCanLeaveNetwork();
        logger.info('canLeaveNetwork', canLeaveNetwork);
        dispatch(setSetting('canLeaveNetwork', canLeaveNetwork));
      }),

      environmentMgr.connectProperty('signalCheckForUpdatesChanged', async () => {
        const checkForUpdates = await environmentMgr.getCheckForUpdates();
        logger.info('checkForUpdates', checkForUpdates);
        dispatch(setSetting('checkForUpdatesSetting', checkForUpdates));
      }),

      environmentMgr.connectProperty('onAllowHybridViewChanged', async () => {
        const allowHybridView = await environmentMgr.getAllowHybridView();
        logger.debug('onAllowHybridViewChanged', allowHybridView);
        dispatch(setSetting('allowHybridView', allowHybridView));
      }),

      environmentMgr.connectProperty('signalShredderIntensityChanged', async () => {
        const shredderIntensity = await environmentMgr.getShredderIntensity();
        logger.info('signalShredderIntensityChanged', shredderIntensity);
        dispatch(setSetting('shredderIntensity', shredderIntensity));
      }),

      environmentMgr.connectProperty('signalCanStart11CallChanged', async () => {
        const canStart11Call = await environmentMgr.getCanStart11Call();
        logger.info('signalCanStart11CallChanged', canStart11Call);
        dispatch(setSetting('canStart11Call', canStart11Call));
      }),

      environmentMgr.connectProperty('signalCanStartGroupCallChanged', async () => {
        const canStartGroupCall = await environmentMgr.getCanStartGroupCall();
        logger.info('signalCanStartGroupCallChanged', canStartGroupCall);
        dispatch(setSetting('canStartGroupCall', canStartGroupCall));
      }),

      environmentMgr.connectProperty('signalCanStartRoomCallChanged', async () => {
        const canStartRoomCall = await environmentMgr.getCanStartRoomCall();
        logger.info('signalCanStartRoomCallChanged', canStartRoomCall);
        dispatch(setSetting('canStartRoomCall', canStartRoomCall));
      }),

      environmentMgr.connectProperty('signalEnableFileDownloadChanged', async () => {
        const enableFileDownload = await environmentMgr.getEnableFileDownload();
        logger.info('signalEnableFileDownloadChanged', enableFileDownload);
        dispatch(setSetting('enableFileDownload', enableFileDownload));
      }),

      environmentMgr.connectProperty('signalNetworkBannerConfigChanged', async () => {
        const networkBannerConfig = await environmentMgr.getNetworkBannerConfig();
        logger.info('signalNetworkBannerConfigChanged', networkBannerConfig);
        dispatch(updateNetworkBannerConfig(networkBannerConfig));
      }),

      environmentMgr.connectProperty('signalConsentPopupConfigChanged', async () => {
        const consentPopupConfig = await environmentMgr.getConsentPopupConfig();
        logger.info('signalConsentPopupConfigChanged', !!consentPopupConfig);
        dispatch(updateConsentPopupConfig(consentPopupConfig));
      }),

      environmentMgr.connectProperty('signalEnableScreenCaptureChanged', async () => {
        const enableScreenCapture = await environmentMgr.getEnableScreenCapture();
        logger.info('signalEnableScreenCaptureChanged', enableScreenCapture);
        dispatch(setSetting('enableScreenCapture', enableScreenCapture));
      }),

      environmentMgr.connectProperty('signalEnableNotificationSenderInfoChanged', async () => {
        const enableNotificationSenderInfo = await environmentMgr.getEnableNotificationSenderInfo();
        logger.info('signalEnableNotificationSenderInfoChanged', enableNotificationSenderInfo);
        dispatch(setSetting('enableNotificationSenderInfo', enableNotificationSenderInfo));
      }),

      environmentMgr.connectProperty('signalMessageForwardingEnabledChanged', async () => {
        const messageForwardingEnabled = await environmentMgr.getMessageForwardingEnabled();
        logger.info('signalMessageForwardingEnabledChanged', messageForwardingEnabled);
        dispatch(setSetting('messageForwardingEnabled', messageForwardingEnabled));
      }),

      environmentMgr.connectProperty('signalTdfEnabledChanged', async () => {
        const tdfEnabled = await environmentMgr.getTdfEnabled();
        logger.info('signalTdfEnabledChanged', tdfEnabled);
        dispatch(setSetting('tdfEnabled', tdfEnabled));
      }),

      environmentMgr.connect('signalSessionWarning', () => {
        logger.info('signalSessionWarning');
        dispatch(closeAllQmlPanels());
        dispatch(setShowSessionTimeoutMenuItem(true));
        dispatch(openModal('SessionExpiringModal'));
      }),

      environmentMgr.connect('signalSessionExpiresAtChanged', async () => {
        const sessionExpiresAt = await environmentMgr.getSessionExpiresAt();
        logger.info('signalSessionExpiresAtChanged', sessionExpiresAt);
        dispatch(updateSessionExpiresAt(sessionExpiresAt));
      }),
    ];

    return () => unsubs.forEach((unsub) => unsub());
  }, [environmentMgr, dispatch]);

  return null;
};
