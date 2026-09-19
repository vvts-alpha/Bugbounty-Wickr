import { ChangeEvent, FormEvent, useState } from 'react';
import {
  Modal,
  ModalBody,
  ModalButtonGroup,
  ModalHeader,
  Button,
  PrimaryButton,
  FormField,
} from '@/componentlibrary';
import { useAppTranslation } from '@/lib/i18n';
import { useAppDispatch } from '@/store';

import { closeModal } from '@/store/thunks/modals';
import styles from './styles.module.less';

const SignIntoOutlookAddInModal = () => {
  const { t } = useAppTranslation();
  const dispatch = useAppDispatch();
  const [verificationCode, setVerificationCode] = useState('');

  const handleCancel = () => {
    dispatch(closeModal('SignIntoOutlookAddInModal'));
  };

  const handleJoin = () => {
    // TODO: Implement Express pairing input API
  };

  const handleFormSubmit = (e: FormEvent) => {
    e.preventDefault();
    handleJoin();
  };

  const handleOnChangeInput = (e: ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setVerificationCode(newValue);
  };

  return (
    <Modal
      closeLabel={t('Close')}
      className={styles.signIntoOutlookAddInModal}
      onClose={handleCancel}
    >
      <ModalHeader>
        <div>
          <h2 className={styles.title}>{t('Sign into Outlook add-in')}</h2>
          <h3 className={styles.subtitle}>
            {t('Enter the verification code provided from the sign in process.')}
          </h3>
        </div>
      </ModalHeader>
      <form onSubmit={handleFormSubmit}>
        <ModalBody className={styles.body}>
          <FormField
            className={styles.verificationCodeInput}
            fieldName="input"
            fieldProps={{
              showClear: false,
            }}
            label={t('Verification code')}
            value={verificationCode}
            onChange={handleOnChangeInput}
          />
        </ModalBody>
        <ModalButtonGroup>
          <Button bordered onClick={handleCancel}>
            {t('Cancel')}
          </Button>
          <PrimaryButton type="submit" aria-disabled={!verificationCode}>
            {t('Join')}
          </PrimaryButton>
        </ModalButtonGroup>
      </form>
    </Modal>
  );
};

export default SignIntoOutlookAddInModal;
