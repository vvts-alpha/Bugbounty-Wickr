import { Modal, ModalBody, ModalButtonGroup, ModalHeader, PrimaryButton } from '@/componentlibrary';
import { useAppTranslation } from '@/lib/i18n';
import { useAppDispatch, useAppSelector } from '@/store';
import { selectDataRetentionModalParams } from '@/store/slices/modal';

import { closeModal } from '@/store/thunks/modals';
import styles from './styles.module.less';

const DataRetentionModal = () => {
  const { t } = useAppTranslation();
  const dispatch = useAppDispatch();
  const { isValid } = useAppSelector(selectDataRetentionModalParams);
  const handleClose = () => {
    dispatch(closeModal('DataRetentionModal'));
  };

  return (
    <Modal variant="alert" onClose={handleClose}>
      <ModalHeader
        title={isValid ? t('Data Retention Turned On') : t('Data retention change detected')}
      />
      <ModalBody>
        <div className={styles.textContainer}>
          {isValid ? (
            <>
              <p>
                {t(
                  "The network administrator in your organization has turned data retention on. Conversations in this network can be retained by your organization. External networks need to be on app version 6.18 or higher to be compatible with your organization's data retention policies."
                )}
              </p>
              <p>
                {t(
                  'Wickr cannot access any content on this network, and all conversations are end-to-end encrypted.'
                )}
              </p>
              <p>{t('Please click Continue to proceed.')}</p>
            </>
          ) : (
            <>
              <p>{t('Your data retention settings may have changed.')}</p>
              <p>
                {t('If this alert is unexpected, please contact your Administrator immediately.')}
              </p>
            </>
          )}
        </div>
      </ModalBody>
      <ModalButtonGroup>
        <PrimaryButton onClick={handleClose}>{t('Continue')}</PrimaryButton>
      </ModalButtonGroup>
    </Modal>
  );
};

export default DataRetentionModal;
