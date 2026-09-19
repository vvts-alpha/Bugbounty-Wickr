import { useState } from 'react';
import {
  Button,
  Modal,
  ModalBody,
  ModalButtonGroup,
  ModalHeader,
  PrimaryButton,
} from '@/componentlibrary';
import { useAppTranslation } from '@/lib/i18n';
import { useAppDispatch, useAppSelector } from '@/store';
import { pushModal, selectAtoVerificationModalParams } from '@/store/slices/modal';
import { blockATORequest } from '@/store/thunks/identity';
import { closeModal } from '@/store/thunks/modals';

import styles from './styles.module.less';

enum AtoView {
  ANNOUNCEMENT,
  SHOW_CODE,
  SHOW_SECURE_ACCOUNT,
}

const AtoVerificationCodeModal = () => {
  const { t } = useAppTranslation();
  const dispatch = useAppDispatch();
  const { code } = useAppSelector(selectAtoVerificationModalParams);
  const [view, setView] = useState<AtoView>(AtoView.ANNOUNCEMENT);

  const renderBody = () => {
    switch (view) {
      case AtoView.ANNOUNCEMENT:
        return (
          <>
            <ModalHeader title={t('Did you just sign-in?')} />
            <ModalBody className={styles.body}>
              <p>{t('Your ID is being used to sign-in to a new device.')}</p>
              <p>{t('Get code to verify the new device.')}</p>
            </ModalBody>
            <ModalButtonGroup>
              <Button
                onClick={() => {
                  dispatch(blockATORequest());
                  setView(AtoView.SHOW_SECURE_ACCOUNT);
                }}
              >
                {t('Deny')}
              </Button>
              <PrimaryButton onClick={() => setView(AtoView.SHOW_CODE)}>
                {t('Get Code')}
              </PrimaryButton>
            </ModalButtonGroup>
          </>
        );
      case AtoView.SHOW_CODE:
        return (
          <>
            <ModalHeader title={t('AWS Wickr Verification Code')} />
            <ModalBody className={styles.body}>
              <p>{t('Enter this verification code on your new device to sign in.')}</p>
              <h2 className={styles.code}>{code}</h2>
            </ModalBody>
            <ModalButtonGroup>
              <PrimaryButton onClick={handleClose} autoFocus>
                {t('Done')}
              </PrimaryButton>
            </ModalButtonGroup>
          </>
        );
      case AtoView.SHOW_SECURE_ACCOUNT:
        return (
          <>
            <ModalHeader title={t('Secure your account')} />
            <ModalBody className={styles.body}>
              {t('Someone tried to login to your account, we recommend changing your password.')}
            </ModalBody>
            <ModalButtonGroup>
              <Button onClick={handleClose}>{t('Cancel')}</Button>
              <PrimaryButton
                onClick={() => {
                  dispatch(pushModal('ChangePasswordModal'));
                  handleClose();
                }}
              >
                {t('Change Password')}
              </PrimaryButton>
            </ModalButtonGroup>
          </>
        );
    }
  };

  const handleClose = () => {
    if (view === AtoView.ANNOUNCEMENT) {
      dispatch(blockATORequest());
    }
    dispatch(closeModal('AtoVerificationCodeModal'));
  };

  return (
    <Modal variant="alert" onClose={handleClose}>
      {renderBody()}
    </Modal>
  );
};

export default AtoVerificationCodeModal;
