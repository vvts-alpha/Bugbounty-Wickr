import { Modal, ModalBody, ModalButtonGroup, ModalHeader, Button } from '@/componentlibrary';
import { useAppTranslation } from '@/lib/i18n';
import { useAppDispatch } from '@/store';
import { closeModal } from '@/store/thunks/modals';

export type SaveFormModalReturn = 'save' | 'discard' | null;

const SaveFormModal = () => {
  const { t } = useAppTranslation();
  const dispatch = useAppDispatch();

  const handleClose = (result?: SaveFormModalReturn) => {
    dispatch(
      closeModal({
        name: 'SaveFormModal',
        returnValue: result,
      })
    );
  };

  return (
    <Modal closeLabel={t('Close')} onClose={() => handleClose()}>
      <ModalHeader title={t('Save Changes?')} />
      <ModalBody>{t('Your changes have not been saved.')}</ModalBody>
      <ModalButtonGroup>
        <Button bordered onClick={() => handleClose('discard')} color="red">
          {t('Discard')}
        </Button>
        <Button onClick={() => handleClose('save')} color="primary">
          {t('Save')}
        </Button>
      </ModalButtonGroup>
    </Modal>
  );
};

export default SaveFormModal;
