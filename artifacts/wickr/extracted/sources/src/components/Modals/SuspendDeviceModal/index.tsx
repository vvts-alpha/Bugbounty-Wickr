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
import { selectSuspendDeviceModalParams } from '@/store/slices/modal';
import { closeModal } from '@/store/thunks/modals';
import { suspendDevice } from '@/store/thunks/settings';

const SuspendDeviceModal = () => {
  const { t } = useAppTranslation();
  const dispatch = useAppDispatch();
  const { activeDevice } = useAppSelector(selectSuspendDeviceModalParams);

  const handleClose = () => {
    dispatch(closeModal('SuspendDeviceModal'));
  };

  const handleSubmit = () => {
    if (activeDevice) {
      dispatch(suspendDevice(activeDevice));
    }
    handleClose();
  };

  return (
    <Modal variant="alert" onClose={handleClose}>
      <ModalHeader title={t('Suspend Device')} />
      <ModalBody>
        {t(
          'Suspending will remove all converstations and preferences on selected device. You can no longer receive or send messages on this device until you login again. This will not terminate your AWS Wickr account.'
        )}
      </ModalBody>
      <ModalButtonGroup>
        <Button bordered onClick={handleClose}>
          {t('Cancel')}
        </Button>
        <PrimaryButton onClick={handleSubmit}>{t('Suspend')}</PrimaryButton>
      </ModalButtonGroup>
    </Modal>
  );
};

export default SuspendDeviceModal;
