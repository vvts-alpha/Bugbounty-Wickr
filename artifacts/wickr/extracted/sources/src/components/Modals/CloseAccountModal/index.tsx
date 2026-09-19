import { Modal, ModalBody, ModalButtonGroup, ModalHeader, Button } from '@/componentlibrary';
import { useAppTranslation } from '@/lib/i18n';
import { useAppDispatch } from '@/store';
import { confirmSsoTerminateAccount } from '@/store/thunks/identity';
import { closeModal } from '@/store/thunks/modals';

const CloseAccountModal = () => {
  const { t } = useAppTranslation();
  const dispatch = useAppDispatch();

  const handleClose = () => dispatch(closeModal('CloseAccountModal'));

  const handleConfirm = () => {
    dispatch(confirmSsoTerminateAccount());
    handleClose();
  };

  return (
    <Modal variant="alert" onClose={handleClose}>
      <ModalHeader title={t('Are you sure you want to close your account')} />
      <ModalBody>
        {t(
          'This is a permanent action. It will delete your Wickr account and reset the application.'
        )}
      </ModalBody>
      <ModalButtonGroup>
        <Button bordered onClick={handleClose}>
          {t('Cancel')}
        </Button>
        <Button color="red" onClick={handleConfirm}>
          {t('Close Account')}
        </Button>
      </ModalButtonGroup>
    </Modal>
  );
};

export default CloseAccountModal;
