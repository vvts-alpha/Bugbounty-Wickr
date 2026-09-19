import {
  Modal,
  ModalBody,
  ModalButtonGroup,
  ModalHeader,
  PrimaryButton,
  Button,
} from '@/componentlibrary';
import { useAppTranslation } from '@/lib/i18n';
import { Logger } from '@/lib/logger';
import { WickrConvoType } from '@/lib/protobuf/convos';
import { useAppDispatch, useAppSelector, useAppSelectorExtra } from '@/store';
import { selectConvo } from '@/store/slices/convos';
import { selectDeleteConvoModalParams } from '@/store/slices/modal';
import { clearPanelStack } from '@/store/slices/panels';
import { deleteConvo } from '@/store/thunks/convos';
import { closeModal } from '@/store/thunks/modals';

const logger = new Logger('DeleteConvoModal');

const DeleteConvoModal = () => {
  const { t } = useAppTranslation();
  const dispatch = useAppDispatch();
  const { vGroupId } = useAppSelector(selectDeleteConvoModalParams);
  const convo = useAppSelectorExtra(selectConvo, vGroupId || '');

  if (!vGroupId) {
    logger.error('Cannot delete convo vGroupId:', vGroupId);
    return null;
  }

  const handleClose = () => {
    dispatch(closeModal('DeleteConvoModal'));
  };

  const handleSubmit = () => {
    dispatch(deleteConvo(vGroupId));
    handleClose();
    dispatch(clearPanelStack());
  };

  return (
    <Modal variant="alert" onClose={handleClose}>
      <ModalHeader title={t('Are you sure?')} />
      <ModalBody>
        {convo?.type === WickrConvoType.Room
          ? t(
              'This will delete all content, and the room will no longer be available to any of the members.'
            )
          : t(
              'This conversation and all of its contents will be permanently deleted. Are you sure you want to delete this conversation?'
            )}
      </ModalBody>
      <ModalButtonGroup>
        <Button bordered onClick={handleClose}>
          {t('Cancel')}
        </Button>
        <PrimaryButton onClick={handleSubmit}>{t('Delete')}</PrimaryButton>
      </ModalButtonGroup>
    </Modal>
  );
};

export default DeleteConvoModal;
