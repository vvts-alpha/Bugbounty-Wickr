import SettingItem, { Divider } from '../SettingItem';
import { CaretIcon, Counter, IconButton, List, PanelOverlay, Toggle } from '@/componentlibrary';
import { useAppTranslation } from '@/lib/i18n';
import { useAppDispatch, useAppSelector } from '@/store';
import { useSetting } from '@/store/hooks/useSetting';
import { selectSelfCallStatus } from '@/store/slices/calls';
import { setOverlay } from '@/store/slices/overlay';
import {
  updateAutoMsgResendEnabled,
  updateAutoMsgResendPeriod,
  updateIsEnableWOAProxy,
} from '@/store/thunks/settings';

import styles from './styles.module.less';

const ConnectivityOverlay = () => {
  const dispatch = useAppDispatch();
  const { t } = useAppTranslation();
  const enableWOA = useSetting('enableWOA');
  const isWOAProxyConfigured = useSetting('isWOAProxyConfigured');
  const isEnableWOAProxy = useSetting('isEnableWOAProxy');
  const autoMsgResendEnabled = useSetting('autoMsgResendEnabled');
  const autoMsgResendPeriod = useSetting('autoMsgResendPeriod');
  const isProd = useSetting('isProduction');
  const isEnterprise = useSetting('isEnterprise');
  const forceWOA = useSetting('forceWOA');
  const inCall = useAppSelector(selectSelfCallStatus);
  const isServerConnected = useSetting('isServerConnected');

  return (
    <PanelOverlay title={t('Connectivity')}>
      <List>
        {isEnterprise && (
          <SettingItem
            title={t('Server Connection')}
            description={t('Check the connection status')}
          >
            <IconButton
              label={t('Server Connection')}
              onClick={() => dispatch(setOverlay('ServerConnection'))}
              bordered
              className={styles.caretBtn}
            >
              <CaretIcon size="20px" className={styles.caretIcon} direction="right" />
            </IconButton>
          </SettingItem>
        )}
        {isWOAProxyConfigured && enableWOA && (
          <SettingItem
            title={t('Enable Wickr Open Access')}
            description={t('Enable this feature for censorship avoidance.')}
          >
            <Toggle
              label={t('Enable Wickr Open Access')}
              checked={isEnableWOAProxy || forceWOA}
              onChange={() => dispatch(updateIsEnableWOAProxy(!isEnableWOAProxy))}
              aria-disabled={forceWOA || inCall || !isServerConnected}
            />
          </SettingItem>
        )}
        <SettingItem
          title={t('Advanced message resend')}
          description={t(
            'Attempt to resend message for 24 hours when network conditions are weak.'
          )}
        >
          <Toggle
            label={t('Advanced message resend')}
            checked={autoMsgResendEnabled}
            onChange={() => dispatch(updateAutoMsgResendEnabled(!autoMsgResendEnabled))}
          />
        </SettingItem>
        {!isProd && autoMsgResendEnabled && (
          <SettingItem
            title={t('Default Message Resend Period (QA Testing)')}
            description={t(
              'On client initial client login, maximum message age to auto-resend (10 minute increments).'
            )}
            className={styles.defaultMessageResendItem}
          >
            <Divider />
            <div className={styles.counterWrapper}>
              <Counter
                count={autoMsgResendPeriod}
                step={10}
                min={10}
                max={1440}
                onChange={(count: number) => dispatch(updateAutoMsgResendPeriod(count))}
                className={styles.counter}
                description={t('Default Message Resend Period (QA Testing)')}
              />
            </div>
          </SettingItem>
        )}
      </List>
    </PanelOverlay>
  );
};

export default ConnectivityOverlay;
