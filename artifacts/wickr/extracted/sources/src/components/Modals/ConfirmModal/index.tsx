import { Modal, ModalBody, ModalButtonGroup, ModalHeader, Button } from '@/componentlibrary';
import { MarkdownText } from '@/components/MarkdownText';
import { useAppTranslation } from '@/lib/i18n';
import { useAppDispatch, useAppSelector } from '@/store';
import { selectConfirmModalParams } from '@/store/slices/modal';
import { closeModal } from '@/store/thunks/modals';

import styles from './styles.module.less';

/** Generic confirmation modal with title, body, and confirm/cancel buttons; similar to window.prompt() */
const ConfirmModal = () => {
  const { t } = useAppTranslation();
  const dispatch = useAppDispatch();
  const params = useAppSelector(selectConfirmModalParams);
  const { body = '', bodyType, title = '', cancelText, confirmText, confirmColor } = params ?? {};
  const handleClose = () => dispatch(closeModal('ConfirmModal'));
  const handleSubmit = () => {
    dispatch(
      closeModal({
        name: 'ConfirmModal',
        returnValue: true,
      })
    );
  };

  return (
    <Modal variant="alert" onClose={handleClose} size={params.size}>
      <ModalHeader title={title} />
      <ModalBody className={styles.body}>
        {bodyType === 'markdown' ? <MarkdownText text={body} /> : body}
      </ModalBody>
      <ModalButtonGroup>
        <Button bordered onClick={handleClose}>
          {cancelText ?? t('Cancel')}
        </Button>
        <Button color={confirmColor || 'primary'} onClick={handleSubmit}>
          {confirmText ?? t('Yes')}
        </Button>
      </ModalButtonGroup>
    </Modal>
  );
};

export default ConfirmModal;
