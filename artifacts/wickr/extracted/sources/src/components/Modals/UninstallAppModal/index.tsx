import { Modal, ModalBody, ModalButtonGroup, ModalHeader, Button } from '@/componentlibrary';
import { useAppTranslation } from '@/lib/i18n';
import { useAppDispatch } from '@/store';
import { closeModal } from '@/store/thunks/modals';
import { uninstallApp } from '@/store/thunks/settings';

const UninstallAppModal = () => {
  const { t } = useAppTranslation();
  const dispatch = useAppDispatch();

  const handleClose = () => dispatch(closeModal('UninstallAppModal'));

  return (
    <Modal variant="alert" onClose={handleClose}>
      <ModalHeader title={t('Are you sure you want to uninstall the application?')} />
      <ModalBody>
        {t('This action will remove all Wickr app data and settings from your device.')}
      </ModalBody>
      <ModalButtonGroup>
        <Button bordered onClick={handleClose}>
          {t('Cancel')}
        </Button>
        <Button color="red" onClick={() => dispatch(uninstallApp())}>
          {t('Uninstall')}
        </Button>
      </ModalButtonGroup>
    </Modal>
  );
};

export default UninstallAppModal;
