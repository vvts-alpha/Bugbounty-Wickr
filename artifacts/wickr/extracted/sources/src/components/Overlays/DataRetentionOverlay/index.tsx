import SettingItem from '../SettingItem';
import {
  CheckCircleFilledIcon,
  CopyIcon,
  Heading,
  IconButton,
  List,
  PanelOverlay,
  Tooltip,
} from '@/componentlibrary';

import { useAppTranslation } from '@/lib/i18n';
import { useAppDispatch } from '@/store';
import { useSetting } from '@/store/hooks/useSetting';
import { setOverlay } from '@/store/slices/overlay';
import { copyTextToClipboard } from '@/utils/strings';

import styles from './styles.module.less';

export const DataRetentionOverlay = () => {
  const dispatch = useAppDispatch();
  const { t } = useAppTranslation();
  const key = useSetting('complianceBotKey')
    .replace(/(.{4})/g, '$1 ')
    .trim();

  return (
    <PanelOverlay
      onClose={() => dispatch(setOverlay('PrivacyAndSafety'))}
      closeLabel={t('Back')}
      title={t('Data Retention Public Key')}
    >
      <List className={styles.list}>
        <SettingItem title={t('Data retention status')} className={styles.statusContainer}>
          <CheckCircleFilledIcon color="var(--green)" />
          <Heading level={3} className={styles.statusText}>
            {t('On') /* this should always be on if the setting is visible */}
          </Heading>
        </SettingItem>
        <SettingItem title={t('Public key')} className={styles.publicKey} description={key}>
          <Tooltip tip={t('Copy to clipboard')}>
            <IconButton
              label={t('Copy to clipboard')}
              onClick={() => copyTextToClipboard(key)}
              className={styles.copyButton}
            >
              <CopyIcon />
            </IconButton>
          </Tooltip>
        </SettingItem>
        <SettingItem
          className={styles.verifyText}
          description={t(
            'Verify the security of your end-to-end encryption by comparing the public key with the bot public key shared by your network admin.'
          )}
        />
      </List>
    </PanelOverlay>
  );
};

export default DataRetentionOverlay;
