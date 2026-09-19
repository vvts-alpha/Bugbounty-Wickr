import { Modal, ModalBody, ModalButtonGroup, ModalHeader, Button } from '@/componentlibrary';
import { useAppTranslation } from '@/lib/i18n';
import { resetDevice } from '@/signin/signinThunks';
import { useAppDispatch, useAppSelector } from '@/store';
import { useFeature } from '@/store/hooks/useFeature';
import { selectResetAppModalParams } from '@/store/slices/modal';
import { setUIAppName } from '@/store/slices/uiApp';
import { closeModal } from '@/store/thunks/modals';
import { resetApp } from '@/store/thunks/settings';

const ResetAppModal = () => {
  const { t } = useAppTranslation();
  const dispatch = useAppDispatch();
  const { variant } = useAppSelector(selectResetAppModalParams);
  const webSignInEnabled = useFeature('Signin');

  const handleClose = () => dispatch(closeModal('ResetAppModal'));

  const handleReset = () => {
    if (variant === 'support') {
      dispatch(resetApp());
      if (webSignInEnabled) {
        dispatch(setUIAppName('signin'));
      }
    } else {
      dispatch(resetDevice());
    }
    handleClose();
  };

  return (
    <Modal variant="alert" onClose={handleClose}>
      <ModalHeader title={t('Reset App')} />
      <ModalBody>
        {variant === 'support'
          ? t(
              'This will log you out, restore your application to its default settings, and delete your message history. If you have another existing device, you can recover your message history when you log in. Are you sure you want to continue?'
            )
          : t(
              'This will restore your application to its default settings. Are you sure you want to continue?'
            )}
      </ModalBody>
      <ModalButtonGroup>
        <Button bordered onClick={handleClose}>
          {t('Cancel')}
        </Button>
        <Button color="red" onClick={handleReset}>
          {t('Reset')}
        </Button>
      </ModalButtonGroup>
    </Modal>
  );
};

export default ResetAppModal;
