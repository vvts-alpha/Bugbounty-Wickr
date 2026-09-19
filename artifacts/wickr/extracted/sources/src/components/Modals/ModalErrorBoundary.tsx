import ErrorBoundary from '../Errors/ErrorBoundary';
import { Modal, ModalBody, ModalButtonGroup, ModalHeader, PrimaryButton } from '@/componentlibrary';
import { useAppTranslation } from '@/lib/i18n';
import { useAppDispatch } from '@/store';
import { useSetting } from '@/store/hooks/useSetting';
import { ModalName } from '@/store/slices/modal';
import { closeModal } from '@/store/thunks/modals';
import { toError } from '@/utils/error';

const ErrorModal: ReactFC<{ modalName: ModalName; error: Error }> = ({ error, modalName }) => {
  const dispatch = useAppDispatch();
  const { t } = useAppTranslation();
  const handleClose = () => dispatch(closeModal(modalName));

  return (
    <Modal onClose={handleClose} closeLabel={t('Close')}>
      <ModalHeader>{t('Error')}</ModalHeader>
      <ModalBody style={{ justifyContent: 'center' }}>
        {modalName} &ndash; {toError(error).message}
      </ModalBody>
      <ModalButtonGroup>
        <PrimaryButton onClick={handleClose}>{t('OK')}</PrimaryButton>
      </ModalButtonGroup>
    </Modal>
  );
};

const ModalErrorBoundary: ReactFC<{ modalName: ModalName }> = ({ modalName, children }) => {
  const isProd = useSetting('isProduction');

  return (
    <ErrorBoundary
      id={modalName}
      Fallback={
        isProd
          ? () => (
              <>
                {/* TODO: Do nothing in prod right now, which is similar to how modals compensate now */}
              </>
            )
          : ({ error }) => <ErrorModal modalName={modalName} error={error} />
      }
    >
      {children}
    </ErrorBoundary>
  );
};

export default ModalErrorBoundary;
