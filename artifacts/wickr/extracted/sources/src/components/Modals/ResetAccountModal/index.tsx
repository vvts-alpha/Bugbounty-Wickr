import { Modal, ModalBody, ModalButtonGroup, ModalHeader, Button } from '@/componentlibrary';
import { useAppTranslation } from '@/lib/i18n';
import { selectSSOCompanyID } from '@/signin/signinSelectors';
import { ssoResetAccount } from '@/signin/signinThunks';
import { useAppDispatch, useAppSelector } from '@/store';
import { closeModal } from '@/store/thunks/modals';

const ResetAccountModal = () => {
  const { t } = useAppTranslation();
  const dispatch = useAppDispatch();
  const companyID = useAppSelector(selectSSOCompanyID);

  const handleClose = () => dispatch(closeModal('ResetAccountModal'));

  const handleReset = () => {
    dispatch(ssoResetAccount(companyID));
    handleClose();
  };

  return (
    <Modal variant="alert" onClose={handleClose}>
      <ModalHeader title={t('Reset account')} />
      <ModalBody>
        {t(
          'Resetting your account will delete your contacts and content in rooms and convos across all your devices associated with your account.'
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

export default ResetAccountModal;
