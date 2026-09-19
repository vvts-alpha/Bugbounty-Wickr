import SettingItem from '../SettingItem';
import { CaretIcon, Button, ExternalLink, IconButton, PanelOverlay } from '@/componentlibrary';
import { useAppTranslation } from '@/lib/i18n';
import { Logger } from '@/lib/logger';
import { useAppDispatch, useAppSelector } from '@/store';
import { AbortError, useAbortableDispatch } from '@/store/hooks/useAbortableDispatch';
import { useSetting } from '@/store/hooks/useSetting';
import { selectSelfUserIsGuest } from '@/store/slices/identity';
import { pushModal } from '@/store/slices/modal';
import { setOverlay } from '@/store/slices/overlay';
import { pushPanel } from '@/store/slices/panels';
import { openAlertModal, openModal } from '@/store/thunks/modals';
import { attemptLeaveNetwork, viewOpenSource } from '@/store/thunks/settings';

import styles from '../styles.module.less';

const logger = new Logger('SupportOverlay');

const SupportOverlay = () => {
  const { t } = useAppTranslation();
  const dispatch = useAppDispatch();
  const abortableDispatch = useAbortableDispatch();
  const canLeaveNetwork = useSetting('canLeaveNetwork');
  const ssoEnabled = useSetting('ssoEnabled');
  const isEnterprise = useSetting('isEnterprise');
  const isGuest = useAppSelector(selectSelfUserIsGuest);
  const brandingLinks = useSetting('brandingLinks');
  const isComplianceConfigValid = useSetting('isComplianceConfigValid');

  const handleSupportLoggingClick = () => {
    dispatch(pushPanel({ name: 'SettingsPanel' }));
    dispatch(setOverlay('SupportLogging'));
  };

  const handleLeaveNetwork = async (incorrectPassword: boolean) => {
    try {
      const password = await abortableDispatch(
        openModal({ name: 'LeaveNetworkModal', params: { incorrectPassword } })
      );

      if (typeof password !== 'string') {
        return;
      }

      const response = await dispatch(attemptLeaveNetwork({ password })).unwrap();

      if (!response) {
        // this only happens if the password is an empty string
        return;
      }

      if (!response.status) {
        if (response.errorType === 'password') {
          handleLeaveNetwork(true);
        } else if (response.errorType === 'admin') {
          dispatch(
            openAlertModal({
              title: t('Leave Network Failed'),
              body: t('Please contact your administator.'),
            })
          );
        } else {
          dispatch(openModal('SomethingWentWrongModal'));
        }
      }
    } catch (err) {
      // Error if not via an abort
      if (!(err instanceof AbortError)) {
        logger.error(err);
        dispatch(openModal('SomethingWentWrongModal'));
      }
    }
  };

  return (
    <PanelOverlay title={t('Support')}>
      <SettingItem className={styles.linkItem}>
        <ExternalLink className={styles.link} href={brandingLinks?.faqURL} showExternalLinkIcon>
          {t('FAQ')}
        </ExternalLink>
      </SettingItem>
      <SettingItem className={styles.linkItem}>
        <ExternalLink
          className={styles.link}
          href={brandingLinks?.keyboardShortcutInstructionsURL}
          showExternalLinkIcon
        >
          {t('Keyboard Shortcuts')}
        </ExternalLink>
      </SettingItem>
      <SettingItem className={styles.linkItem}>
        <ExternalLink
          className={styles.link}
          href={brandingLinks?.privacyPolicyURL}
          showExternalLinkIcon
        >
          {t('Privacy Notice')}
        </ExternalLink>
      </SettingItem>
      {isComplianceConfigValid && (
        <SettingItem className={styles.linkItem}>
          <ExternalLink
            className={styles.link}
            href={brandingLinks?.complianceLearnMoreUrl}
            showExternalLinkIcon
          >
            {t('Data Retention Network')}
          </ExternalLink>
        </SettingItem>
      )}
      <SettingItem className={styles.linkItem}>
        <ExternalLink className={styles.link} href={brandingLinks?.supportURL} showExternalLinkIcon>
          {t('Support Site')}
        </ExternalLink>
      </SettingItem>
      <SettingItem title={t('Support Logging')}>
        <IconButton
          label={t('Support Logging')}
          onClick={handleSupportLoggingClick}
          bordered
          className={styles.caretBtn}
        >
          <CaretIcon size="20px" className={styles.caretIcon} direction="right" />
        </IconButton>
      </SettingItem>
      <SettingItem title={t('Open Source')}>
        <IconButton
          label={t('Open Source')}
          onClick={() => dispatch(viewOpenSource())}
          bordered
          className={styles.caretBtn}
        >
          <CaretIcon size="20px" className={styles.caretIcon} direction="right" />
        </IconButton>
      </SettingItem>
      {canLeaveNetwork && !ssoEnabled && !isEnterprise && (
        <SettingItem title={t('Leave Network')}>
          <Button color="red" onClick={() => handleLeaveNetwork(false)}>
            {t('Leave')}
          </Button>
        </SettingItem>
      )}
      {ssoEnabled && isGuest && (
        <SettingItem title={t('Close Account')}>
          <IconButton
            label={t('Close Account')}
            onClick={() => {
              dispatch(setOverlay('CloseAccount'));
            }}
            bordered
            className={styles.caretBtn}
          >
            <CaretIcon size="20px" className={styles.caretIcon} direction="right" />
          </IconButton>
        </SettingItem>
      )}
      <SettingItem title={t('Reset Application')}>
        <Button
          color="red"
          onClick={() =>
            dispatch(pushModal({ name: 'ResetAppModal', params: { variant: 'support' } }))
          }
        >
          {t('Reset')}
        </Button>
      </SettingItem>
      <SettingItem title={t('Uninstall Application')}>
        <Button color="red" onClick={() => dispatch(pushModal('UninstallAppModal'))}>
          {t('Uninstall')}
        </Button>
      </SettingItem>
    </PanelOverlay>
  );
};

export default SupportOverlay;
