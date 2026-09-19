import { FC } from 'react';
import { CaretIcon, IconButton, List, PanelOverlay, Toggle } from '@/componentlibrary';
import { useAppTranslation } from '@/lib/i18n';
import { useAppDispatch } from '@/store';
import { useSetting } from '@/store/hooks/useSetting';
import { setOverlay } from '@/store/slices/overlay';
import {
  updateIsAutoLockMessages,
  updateIsMetricsEnabled,
  updateLinkPreviewsEnabled,
  updateScreenSecurityEnabled,
  updateTypingIndicatorEnabled,
  updateDeveloperModeEnabled,
} from '@/store/thunks/settings';
import { isWindows } from '@/utils/platform';
import { raw } from '@/utils/strings';
import SettingItem from './SettingItem';

import styles from './styles.module.less';

export const PrivacyAndSafetyOverlay: FC = () => {
  const dispatch = useAppDispatch();
  const { t } = useAppTranslation();
  const isPro = useSetting('isPro');
  const isComplianceConfigValid = useSetting('isComplianceConfigValid');
  const typingIndicatorAllowedRemotely = useSetting('typingIndicatorAllowedRemotely');
  const isTypingIndicatorEnabled = useSetting('isTypingIndicatorEnabled');
  const isAutoUnlockMessages = useSetting('isAutoUnlockMessages');
  const allowLinkPreview = useSetting('allowLinkPreview');
  const linkPreviewsEnabled = useSetting('linkPreviewsEnabled');
  const isSsoEnabled = useSetting('ssoEnabled');
  const isGovCloudAdcEnabled = useSetting('isGovCloudAdcEnabled');
  const isMetricsEnabled = useSetting('isMetricsEnabled');
  const isMetricsAvailable = useSetting('isMetricsAvailable');
  const locationAllowMaps = useSetting('locationAllowMaps');
  const screenSecurityEnabled = useSetting('screenSecurityEnabled');
  const enableScreenCapture = useSetting('enableScreenCapture');
  const isProd = useSetting('isProduction');
  const developerModeEnabled = useSetting('developerModeEnabled');

  return (
    <PanelOverlay title={t('Privacy & Safety')} className={styles.settingsOverlay}>
      <List>
        {isPro && isComplianceConfigValid && (
          <SettingItem
            title={t('Data Retention Public Key')}
            description={t('View data retention status and verify bot public key')}
          >
            <IconButton
              label={t('Data Retention Public Key')}
              onClick={() => dispatch(setOverlay('DataRetention'))}
              bordered
              className={styles.caretBtn}
            >
              <CaretIcon size="20px" className={styles.caretIcon} direction="right" />
            </IconButton>
          </SettingItem>
        )}

        {typingIndicatorAllowedRemotely && (
          <SettingItem
            title={t('Enable Typing Indicators')}
            description={t('See and share typing indicators in chat')}
          >
            <Toggle
              label={t('Enable Typing Indicators')}
              onChange={() => dispatch(updateTypingIndicatorEnabled(!isTypingIndicatorEnabled))}
              checked={!!isTypingIndicatorEnabled}
            />
          </SettingItem>
        )}
        <SettingItem
          title={t('Unlock Messages')}
          description={t(
            'Messages will be automatically unlocked when viewed. Burn-on-read will start immediately'
          )}
        >
          <Toggle
            label={t('Unlock Messages')}
            onChange={() => dispatch(updateIsAutoLockMessages(!isAutoUnlockMessages))}
            checked={!!isAutoUnlockMessages}
          />
        </SettingItem>
        {isPro && !isSsoEnabled && !isGovCloudAdcEnabled && (
          <SettingItem
            title={t('Activate Two-factor Authentication')}
            description={t('Two-factor authentication will disable auto-login feature')}
          >
            <IconButton
              label={t('Activate Two-factor Authentication')}
              onClick={() => dispatch(setOverlay('TwoFA'))}
              bordered
              className={styles.caretBtn}
            >
              <CaretIcon size="20px" className={styles.caretIcon} direction="right" />
            </IconButton>
          </SettingItem>
        )}
        {locationAllowMaps && (
          <SettingItem
            title={t('Location Sharing')}
            description={t('Select display options for location sharing')}
          >
            <IconButton
              label={t('Location Sharing')}
              onClick={() => dispatch(setOverlay('LocationSharing'))}
              bordered
              className={styles.caretBtn}
            >
              <CaretIcon size="20px" className={styles.caretIcon} direction="right" />
            </IconButton>
          </SettingItem>
        )}
        {allowLinkPreview && (
          <SettingItem
            title={t('Send Link Preview')}
            description={t(
              'Enabling this feature will provide recipients with contextual link information'
            )}
          >
            <Toggle
              label={t('Send Link Preview')}
              onChange={() => dispatch(updateLinkPreviewsEnabled(!linkPreviewsEnabled))}
              checked={!!linkPreviewsEnabled}
            />
          </SettingItem>
        )}
        <SettingItem title={t('Blocked Users')} description={t('Manage your blocked users')}>
          <IconButton
            label={t('Blocked Users')}
            onClick={() => dispatch(setOverlay('BlockedUsers'))}
            bordered
            className={styles.caretBtn}
          >
            <CaretIcon size="20px" className={styles.caretIcon} direction="right" />
          </IconButton>
        </SettingItem>
        <SettingItem
          title={t('Secure Shredder')}
          description={t('Run Secure Shredder to overwrite deleted AWS Wickr data')}
        >
          <IconButton
            label={t('Secure Shredder')}
            onClick={() => dispatch(setOverlay('SecureShredder'))}
            className={styles.caretBtn}
            bordered
          >
            <CaretIcon size="20px" className={styles.caretIcon} direction="right" />
          </IconButton>
        </SettingItem>
        <SettingItem
          title={t('Support Logging')}
          description={t('Manage your settings for support logging')}
        >
          <IconButton
            label={t('Support Logging')}
            onClick={() => dispatch(setOverlay('SupportLogging'))}
            bordered
            className={styles.caretBtn}
          >
            <CaretIcon size="20px" className={styles.caretIcon} direction="right" />
          </IconButton>
        </SettingItem>
        {isMetricsAvailable && (
          <SettingItem
            title={t('Metrics Collection')}
            description={t('Enable anonymized performance and usage metrics collection.')}
          >
            <Toggle
              label={t('Metrics Collection')}
              onChange={() => dispatch(updateIsMetricsEnabled(!isMetricsEnabled))}
              checked={isMetricsEnabled}
            />
          </SettingItem>
        )}
        {!isProd && isWindows() && (
          <SettingItem
            title={raw('Screen Security')}
            description={raw(
              'Enabling this feature will cause all screenshots of this app to appear blank, protecting against unauthorized screen capture.'
            )}
          >
            <Toggle
              label={raw('Screen Security')}
              onChange={() => dispatch(updateScreenSecurityEnabled(!screenSecurityEnabled))}
              checked={screenSecurityEnabled || !enableScreenCapture}
              aria-disabled={!enableScreenCapture}
            />
          </SettingItem>
        )}
        <SettingItem
          title={t('Developer Mode')}
          description={t('Enable developer tools and diagnostic UI')}
        >
          <Toggle
            label={t('Developer Mode')}
            onChange={() => dispatch(updateDeveloperModeEnabled(!developerModeEnabled))}
            checked={!!developerModeEnabled}
          />
        </SettingItem>
      </List>
    </PanelOverlay>
  );
};

export default PrivacyAndSafetyOverlay;
