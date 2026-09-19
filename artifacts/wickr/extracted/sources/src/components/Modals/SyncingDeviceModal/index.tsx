import { Modal, ModalBody, ModalHeader } from '@/componentlibrary';
import DBSync from '@/components/DBSync';
import { useAppTranslation } from '@/lib/i18n';
import { useAppDispatch } from '@/store';
import { closeModal } from '@/store/thunks/modals';

import styles from './styles.module.less';

const SyncingDeviceModal = () => {
  const { t } = useAppTranslation();
  const dispatch = useAppDispatch();

  const handleClose = () => {
    dispatch(closeModal('SyncingDeviceModal'));
  };

  return (
    <Modal onClose={handleClose} closeLabel={t('Back')} size="md">
      <ModalHeader title={t('Uploading...')} backButton />
      <ModalBody className={styles.body}>
        <p>
          {t(
            'Securely syncing your rooms, messages and contacts. Please keep Wickr open until uploading is complete.'
          )}
        </p>
        <DBSync />
      </ModalBody>
    </Modal>
  );
};

export default SyncingDeviceModal;
