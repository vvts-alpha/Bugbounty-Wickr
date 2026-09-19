import { ContactBackup } from '@amzn/wickr-messaging-protocol-proto';
import { FC, useEffect, useState } from 'react';
import {
  Panel,
  PanelBody,
  PanelHeader,
  ExternalLink,
  Tabs,
  QRCodeIcon,
  Tab,
  Button,
  CameraFilledIcon,
  SecurityCodeIcon,
  Heading,
  VerifiedIcon,
} from '@/componentlibrary';
import QRCode from '@/components/Verification/QRCode';
import QRScanner from '@/components/Verification/QRScanner';
import SecurityCode from '@/components/Verification/SecurityCode';
import { useAppTranslation } from '@/lib/i18n';
import { useAppDispatch, useAppSelectorExtra } from '@/store';
import { useSetting } from '@/store/hooks/useSetting';
import { useUser } from '@/store/hooks/useUsers';
import {
  clearPanelStack,
  PANEL_SIDES,
  popPanel,
  pushPanel,
  selectIsActivePanel,
  VerifyContactPanelArgs,
} from '@/store/slices/panels';
import { openModal } from '@/store/thunks/modals';
import { fetchUserVerificationFingerprint, VerificationFingerprint } from '@/store/thunks/users';

import styles from './styles.module.less';

enum MySecurityCodeTabs {
  QRScanner = 0,
  SecurityCode = 1,
  QRCode = 2,
}

export const VerifyContactPanel: FC<VerifyContactPanelArgs> = ({ userIdHash, name, closeIcon }) => {
  const { t } = useAppTranslation();
  const side = PANEL_SIDES[name];
  const [tab, setTab] = useState(MySecurityCodeTabs.QRScanner);
  const dispatch = useAppDispatch();
  const panelIsActive = useAppSelectorExtra(selectIsActivePanel, name);
  const contact = useUser(userIdHash);
  const handleOutsideClick = () => panelIsActive && dispatch(clearPanelStack());
  const [fingerprint, setFingerprint] = useState<VerificationFingerprint | undefined>();
  const isVerified =
    contact?.verificationStatus === ContactBackup.Contact.VerificationStatus.VERIFIED;

  const fetchFingerprint = async () => {
    if (!contact) {
      return;
    }

    setFingerprint(await dispatch(fetchUserVerificationFingerprint(contact.id)).unwrap());
  };

  useEffect(() => {
    fetchFingerprint();
  }, [contact]);

  if (!contact) {
    return null;
  }

  let content;
  switch (tab) {
    case MySecurityCodeTabs.SecurityCode:
      content = <SecurityCode fingerprint={fingerprint} userIdHash={userIdHash} />;
      break;
    case MySecurityCodeTabs.QRCode:
      content = <QRCode fingerprint={fingerprint} />;
      break;
    default:
      content = <QRScanner userId={contact.id} fingerprint={fingerprint} />;
  }
  const mlsCapable = !!(fingerprint?.qrFingerPrint && fingerprint.qrFingerPrint.length === 52);

  return (
    <Panel
      onClose={() => dispatch(popPanel())}
      onOutsideClick={handleOutsideClick}
      side={side}
      closeIcon={closeIcon}
    >
      <PanelHeader title={t('Verify Contact')} closeLabel={t('Close')} />
      <PanelBody className={styles.body}>
        <Heading level={3} className={styles.heading}>
          {isVerified
            ? t('{{name}} is verified', { name: contact.name })
            : t('{{name}} is unverified', { name: contact.name })}
          {isVerified && <VerifiedIcon size="16" />}
        </Heading>
        <div className={styles.wrapper}>
          <div className={styles.tabContentContainer}>
            <Tabs selectedLabel={t('selected')} activeTab={tab} onSelectTab={setTab} variant="bar">
              {mlsCapable ? (
                <>
                  <Tab index={MySecurityCodeTabs.QRScanner} ariaLabel={t('Scan QR code')}>
                    <QRCodeIcon />
                    {t('Scan QR code')}
                  </Tab>
                  <Tab index={MySecurityCodeTabs.SecurityCode} ariaLabel={t('Security code')}>
                    <SecurityCodeIcon />
                    {t('Security code')}
                  </Tab>
                </>
              ) : (
                <>
                  <Tab index={MySecurityCodeTabs.QRScanner} ariaLabel={t('Scan')}>
                    <CameraFilledIcon />
                    {t('Scan')}
                  </Tab>
                  <Tab index={MySecurityCodeTabs.QRCode} ariaLabel={t('QR code')}>
                    <QRCodeIcon />
                    {t('QR code')}
                  </Tab>
                  <Tab index={MySecurityCodeTabs.SecurityCode} ariaLabel={t('Security code')}>
                    <SecurityCodeIcon />
                    {t('Security code')}
                  </Tab>
                </>
              )}
            </Tabs>
            {content}
          </div>
        </div>
        {mlsCapable && (
          <Button color="secondary" onClick={() => dispatch(openModal('MySecurityCodeModal'))}>
            {t('Show my security code')}
          </Button>
        )}
      </PanelBody>
    </Panel>
  );
};

export const LearnMoreVerificationButton: FC = () => {
  const isEnterprise = useSetting('isEnterprise');
  const dispatch = useAppDispatch();
  const { t } = useAppTranslation();
  const brandingLinks = useSetting('brandingLinks');

  const handleLearnMoreClick = (e: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => {
    if (!isEnterprise) {
      // Non-enterprise builds should just open the external link
      return;
    }

    e.preventDefault();
    dispatch(pushPanel({ name: 'LearnMoreVerificationPanel' }));
  };

  return (
    <ExternalLink
      onClick={handleLearnMoreClick}
      href={brandingLinks?.verificationLearnMoreUrl}
      showExternalLinkIcon
    >
      {t('Learn More')}
    </ExternalLink>
  );
};
