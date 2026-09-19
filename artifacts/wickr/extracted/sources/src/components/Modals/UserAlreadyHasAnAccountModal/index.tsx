import {
  Modal,
  ModalBody,
  ModalButtonGroup,
  ModalHeader,
  PrimaryButton,
  Button,
} from '@/componentlibrary';
import { useAppTranslation } from '@/lib/i18n';
import { useAppDispatch, useAppSelector } from '@/store';
import { selectUserAlreadyHasAnAccountParams } from '@/store/slices/modal';
import { clearPanelStack } from '@/store/slices/panels';
import { createDM } from '@/store/thunks/messages';
import { closeModal } from '@/store/thunks/modals';

const UserAlreadyHasAnAccountModal = () => {
  const { t } = useAppTranslation();
  const dispatch = useAppDispatch();
  const user = useAppSelector(selectUserAlreadyHasAnAccountParams)?.user;

  const handleClose = () => {
    dispatch(closeModal('UserAlreadyHasAnAccountModal'));
  };

  const handleSubmit = () => {
    if (user) {
      dispatch(
        createDM({
          message: ' ',
          userHash: user.idHash,
          userId: user.id,
        })
      );
      dispatch(clearPanelStack());
    }
    handleClose();
  };

  return (
    <Modal variant="alert" onClose={handleClose}>
      <ModalHeader title={t('This user already has an account')} />
      <ModalBody>{t('Would you like to start a conversation?')}</ModalBody>
      <ModalButtonGroup>
        <Button bordered onClick={handleClose}>
          {t('Not now')}
        </Button>
        <PrimaryButton onClick={handleSubmit}>{t('Yes')}</PrimaryButton>
      </ModalButtonGroup>
    </Modal>
  );
};

export default UserAlreadyHasAnAccountModal;
