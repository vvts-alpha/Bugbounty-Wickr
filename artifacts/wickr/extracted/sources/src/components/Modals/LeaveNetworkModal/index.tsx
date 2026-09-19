import { ChangeEvent, FormEvent, useState } from 'react';
import {
  Modal,
  ModalBody,
  ModalButtonGroup,
  ModalHeader,
  Button,
  FormField,
} from '@/componentlibrary';
import { useAppTranslation } from '@/lib/i18n';
import { useAppDispatch, useAppSelector } from '@/store';
import { selectLeaveNetworkModalParams } from '@/store/slices/modal';
import { closeModal } from '@/store/thunks/modals';

import styles from './styles.module.less';

const LeaveNetworkModal = () => {
  const { t } = useAppTranslation();
  const dispatch = useAppDispatch();
  const params = useAppSelector(selectLeaveNetworkModalParams);

  const [passwordInput, setPasswordInput] = useState('');
  const [noPasswordError, setNoPasswordError] = useState(false);
  const [incorrectPasswordError, setIncorrectPasswordError] = useState(!!params.incorrectPassword);

  const handleClose = () => dispatch(closeModal('LeaveNetworkModal'));

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!passwordInput.trim().length) {
      setNoPasswordError(true);
      return;
    }
    dispatch(
      closeModal({
        name: 'LeaveNetworkModal',
        returnValue: passwordInput,
      })
    );
  };

  const handleOnChangeInput = (e: ChangeEvent<HTMLInputElement>) => {
    setNoPasswordError(false);
    setIncorrectPasswordError(false);
    const { value } = e.target;
    setPasswordInput(value);
  };

  return (
    <Modal variant="alert" onClose={handleClose}>
      <ModalHeader title={t('Leave Network')} />
      <form onSubmit={handleSubmit}>
        <ModalBody className={styles.body}>
          <p>{t('This will remove you from your current network. Are you sure?')}</p>
          <FormField
            className={styles.formField}
            fieldName="input"
            label={t('Enter your password')}
            fieldProps={{ type: 'password' }}
            onChange={handleOnChangeInput}
            hasError={noPasswordError || incorrectPasswordError}
            errorContent={noPasswordError ? t('Password required') : t('Password is incorrect')}
            value={passwordInput}
          />
        </ModalBody>
        <ModalButtonGroup>
          <Button bordered onClick={handleClose}>
            {t('Cancel')}
          </Button>
          <Button color="red" type="submit">
            {t('Leave')}
          </Button>
        </ModalButtonGroup>
      </form>
    </Modal>
  );
};

export default LeaveNetworkModal;
