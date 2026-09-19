import SettingItem from '../SettingItem';
import { List, PanelOverlay, Toggle, PrimaryButton } from '@/componentlibrary';
import { useAppTranslation } from '@/lib/i18n';
import { useAppDispatch } from '@/store';
import { useSetting } from '@/store/hooks/useSetting';
import { setOverlay } from '@/store/slices/overlay';

import {
  clearLogs,
  saveLogs,
  updateLoggingEnabled,
  updateLoggingExtendedEnabled,
} from '@/store/thunks/settings';
import styles from './styles.module.less';

const SupportLoggingOverlay = () => {
  const dispatch = useAppDispatch();
  const { t } = useAppTranslation();
  const loggingEnabled = useSetting('loggingEnabled');
  const loggingExtendedEnabled = useSetting('loggingExtendedEnabled');

  return (
    <PanelOverlay
      title={t('Customer Support Logging')}
      onClose={() => dispatch(setOverlay('PrivacyAndSafety'))}
      closeLabel={t('Back')}
    >
      <List>
        <SettingItem title={t('Allow Support Logging')} className={styles.allowSupportLoggingItem}>
          <p>
            {t(
              'Log files do not contain any personally identifiable information and are stored locally on your device, where they may be manually shared with AWS Wickr Support.'
            )}
          </p>
          <Toggle
            label={t('Allow Support Logging')}
            onChange={() => dispatch(updateLoggingEnabled(!loggingEnabled))}
            checked={!!loggingEnabled}
          />
        </SettingItem>
        <SettingItem
          title={t('Enable or disable extended logging detail (for investigations only)')}
        >
          <Toggle
            label={t('Enable extended logging detail')}
            onChange={() => dispatch(updateLoggingExtendedEnabled(!loggingExtendedEnabled))}
            checked={!!loggingExtendedEnabled}
          />
        </SettingItem>
        <SettingItem title={t('Saves client logs to specified location')}>
          <PrimaryButton
            className={styles.btn}
            onClick={() => dispatch(() => dispatch(saveLogs()))}
          >
            {t('Save Logs')}
          </PrimaryButton>
        </SettingItem>
        <SettingItem title={t('Clears current client logs')}>
          <PrimaryButton
            className={styles.btn}
            onClick={() => dispatch(() => dispatch(clearLogs()))}
          >
            {t('Clear logs')}
          </PrimaryButton>
        </SettingItem>
      </List>
    </PanelOverlay>
  );
};

export default SupportLoggingOverlay;
