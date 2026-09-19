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
import { selectConvo, selectConvoCanLeaveConvo, selectConvoTitle } from '@/store/slices/convos';
import { pushModal, selectLeaveConvoModalParams } from '@/store/slices/modal';
import { clearPanelStack } from '@/store/slices/panels';
import { leaveConvo } from '@/store/thunks/convos';
import { closeModal } from '@/store/thunks/modals';

const logger = new Logger('LeaveConvoModal');

const LeaveConvoModal = () => {
  const { t } = useAppTranslation();
  const dispatch = useAppDispatch();
  const { vGroupId } = useAppSelector(selectLeaveConvoModalParams);
  const convo = useAppSelectorExtra(selectConvo, vGroupId);
  const name = useAppSelectorExtra(selectConvoTitle, vGroupId);
  const canLeaveConvo = useAppSelectorExtra(selectConvoCanLeaveConvo, vGroupId);

  if (!vGroupId) {
    logger.error('Cannot leave convo vGroupId:', vGroupId);
    return null;
  }

  const handleClose = () => {
    dispatch(closeModal('LeaveConvoModal'));
  };

  const handleSubmit = () => {
    if (
      (convo?.type === WickrConvoType.Room &&
        convo.membersInfo.length > 1 &&
        convo.isModerator &&
        convo.moderatorCount === 1) ||
      !canLeaveConvo
    ) {
      dispatch(pushModal({ name: 'CantLeaveRoomModal', params: { vGroupId } }));
    } else {
      dispatch(leaveConvo(vGroupId));
    }
    handleClose();
    dispatch(clearPanelStack());
  };

  return (
    <Modal variant="alert" onClose={handleClose}>
      <ModalHeader title={t('Are you sure?')} />
      <ModalBody>
        {convo?.type === WickrConvoType.Room
          ? t(
              "If you leave {{name}} you won't see any room content. To return to the room, a room moderator will have to add you again.",
              { name }
            )
          : t(
              "If you leave, you won't see any group content. To return to the group, a member will have to add you again."
            )}
      </ModalBody>
      <ModalButtonGroup>
        <Button bordered onClick={handleClose}>
          {t('Cancel')}
        </Button>
        <PrimaryButton onClick={handleSubmit}>{t('Leave')}</PrimaryButton>
      </ModalButtonGroup>
    </Modal>
  );
};

export default LeaveConvoModal;
