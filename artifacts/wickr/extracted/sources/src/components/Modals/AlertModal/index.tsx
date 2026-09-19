import { Modal, ModalBody, ModalButtonGroup, ModalHeader, PrimaryButton } from '@/componentlibrary';
import { useAppTranslation } from '@/lib/i18n';
import { useAppDispatch, useAppSelector } from '@/store';
import { selectAlertModalParams } from '@/store/slices/modal';
import { closeModal } from '@/store/thunks/modals';

import styles from './styles.module.less';

/** Generic alert modal with title, body, and button; similar to window.alert() */
const AlertModal = () => {
  const { t } = useAppTranslation();
  const dispatch = useAppDispatch();
  const error = useAppSelector(selectAlertModalParams);
  const handleClose = () => {
    dispatch(closeModal('AlertModal'));
  };

  return (
    <Modal variant="alert" onClose={handleClose} size={error.size}>
      <ModalHeader title={error.title} />
      <ModalBody className={styles.messageBody}>{error.body}</ModalBody>
      <ModalButtonGroup>
        <PrimaryButton onClick={handleClose}>{error.buttonText ?? t('OK')}</PrimaryButton>
      </ModalButtonGroup>
    </Modal>
  );
};

export default AlertModal;
