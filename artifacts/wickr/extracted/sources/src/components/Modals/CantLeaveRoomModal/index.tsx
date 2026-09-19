import {
  Button,
  Modal,
  ModalBody,
  ModalButtonGroup,
  ModalHeader,
  PrimaryButton,
} from '@/componentlibrary';
import { useAppTranslation } from '@/lib/i18n';
import { useAppDispatch, useAppSelector } from '@/store';
import { pushModal, selectCantLeaveRoomModalParams } from '@/store/slices/modal';
import { closeModal } from '@/store/thunks/modals';

const CantLeaveRoomModal = () => {
  const { t } = useAppTranslation();
  const dispatch = useAppDispatch();
  const { vGroupId } = useAppSelector(selectCantLeaveRoomModalParams);

  const handleClose = () => {
    dispatch(closeModal('CantLeaveRoomModal'));
  };
  const openDeleteRoom = () => {
    dispatch(pushModal({ name: 'DeleteConvoModal', params: { vGroupId } }));
  };
  return (
    <Modal variant="alert" onClose={handleClose}>
      <ModalHeader title={t("Can't Leave")} />
      <ModalBody>
        {t(
          'You are currently the only room moderator. Please make someone a room moderator before leaving this room.'
        )}
      </ModalBody>
      <ModalButtonGroup>
        <Button bordered onClick={handleClose}>
          {t('OK')}
        </Button>
        <PrimaryButton onClick={openDeleteRoom}>{t('Delete Room')}</PrimaryButton>
      </ModalButtonGroup>
    </Modal>
  );
};

export default CantLeaveRoomModal;
