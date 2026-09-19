import { Modal, ModalBody, ModalButtonGroup, ModalHeader, PrimaryButton } from '@/componentlibrary';
import { useAppTranslation } from '@/lib/i18n';
import { useAppDispatch } from '@/store';

import { closeModal } from '@/store/thunks/modals';
import styles from './SomethingWentWrongModal.module.less';

const SomethingWentWrongModal = () => {
  const dispatch = useAppDispatch();
  const { t } = useAppTranslation();

  const handleClose = () => {
    dispatch(closeModal('SomethingWentWrongModal'));
  };

  return (
    <Modal variant="alert" onClose={handleClose} className={styles.root}>
      <ModalHeader title={t('FileManagement.SomethingWentWrong')}></ModalHeader>
      <ModalBody className={styles.body}>{t('FileManagement.PleaseTryAgain')}</ModalBody>
      <ModalButtonGroup>
        <PrimaryButton onClick={handleClose}>{t('OK')}</PrimaryButton>
      </ModalButtonGroup>
    </Modal>
  );
};

export default SomethingWentWrongModal;
