import { useState } from 'react';
import {
  Modal,
  ModalBody,
  ModalHeader,
  IconButton,
  Tabs,
  QRCodeIcon,
  Tab,
  CaretIcon,
  SecurityCodeIcon,
} from '@/componentlibrary';
import QRCode from '@/components/Verification/QRCode';
import SecurityCode from '@/components/Verification/SecurityCode';
import { useAsyncEffect } from '@/hooks/useAsyncEffect';
import { useAppTranslation } from '@/lib/i18n';
import { useAppDispatch, useAppSelector } from '@/store';
import { selectSelfUser, selectSelfUserIdHash } from '@/store/slices/identity';
import { closeModal } from '@/store/thunks/modals';
import { fetchUserVerificationFingerprint, VerificationFingerprint } from '@/store/thunks/users';

import styles from './styles.module.less';

enum MySecurityCodeTabs {
  QrCode = 0,
  SecurityCode = 1,
}

const MySecurityCodeModal = () => {
  const { t } = useAppTranslation();
  const dispatch = useAppDispatch();
  const selfUser = useAppSelector(selectSelfUser);
  const userHashId = useAppSelector(selectSelfUserIdHash);
  const [fingerprint, setFingerprint] = useState<VerificationFingerprint | undefined>();
  const [tab, setTab] = useState(MySecurityCodeTabs.QrCode);

  const handleClose = () => dispatch(closeModal('MySecurityCodeModal'));

  useAsyncEffect(() => {
    if (!selfUser) {
      return;
    }
    const fetchFingerprint = async () => {
      setFingerprint(await dispatch(fetchUserVerificationFingerprint(selfUser.id)).unwrap());
    };

    fetchFingerprint();
  }, [selfUser]);

  const content =
    tab === MySecurityCodeTabs.QrCode ? (
      <QRCode fingerprint={fingerprint} />
    ) : (
      <SecurityCode fingerprint={fingerprint} userIdHash={userHashId} />
    );

  return (
    <Modal className={styles.modal} variant="alert" onClose={handleClose}>
      <IconButton
        label={t('Close')}
        onClick={handleClose}
        wrapperClassName={styles.closeWrapper}
        className={styles.close}
      >
        <CaretIcon direction="left" size="20px" />
      </IconButton>
      <ModalHeader title={t('My security code')} className={styles.header} />
      <ModalBody className={styles.body}>
        <p className={styles.description}>
          {t(
            'Other users can verify your identity in person by scanning your QR code using their Wickr device. They can also verify you remotely by comparing your identity code with the one displayed on your profile on their Wickr device.'
          )}
        </p>
        <div className={styles.codeContainer}>
          <Tabs
            selectedLabel={t('selected')}
            className={styles.tabs}
            onSelectTab={setTab}
            variant="bar"
          >
            <Tab index={MySecurityCodeTabs.QrCode} className={styles.tab} ariaLabel={t('QR code')}>
              <QRCodeIcon />
              {t('QR code')}
            </Tab>
            <Tab
              index={MySecurityCodeTabs.SecurityCode}
              className={styles.tab}
              ariaLabel={t('Security code')}
            >
              <SecurityCodeIcon />
              {t('Security code')}
            </Tab>
          </Tabs>
          {content}
        </div>
      </ModalBody>
    </Modal>
  );
};

export default MySecurityCodeModal;
