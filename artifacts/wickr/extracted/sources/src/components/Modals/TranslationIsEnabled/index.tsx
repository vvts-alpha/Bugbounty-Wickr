import {
  Button,
  Modal,
  ModalBody,
  ModalButtonGroup,
  ModalHeader,
  PrimaryButton,
} from '@/componentlibrary';
import { useAppTranslation } from '@/lib/i18n';
import { useAppDispatch } from '@/store';
import { clearPanelStack } from '@/store/slices/panels';
import { closeModal } from '@/store/thunks/modals';

const TranslationIsEnabledModal = () => {
  const { t } = useAppTranslation();
  const dispatch = useAppDispatch();

  const handleClose = () => {
    dispatch(closeModal('TranslationIsEnabledModal'));
  };

  const handleRedirect = () => {
    handleClose();
    dispatch(clearPanelStack());
  };

  return (
    <Modal variant="alert" onClose={handleClose}>
      <ModalHeader>{t('Translation Is Enabled')}</ModalHeader>
      <ModalBody>{t('Now you can translate your messages to your preferred language.')}</ModalBody>
      <ModalButtonGroup>
        <Button bordered onClick={handleClose}>
          {t('Close')}
        </Button>
        <PrimaryButton onClick={handleRedirect}>{t('Back to messages')}</PrimaryButton>
      </ModalButtonGroup>
    </Modal>
  );
};

export default TranslationIsEnabledModal;
