import { Modal, ModalBody } from '@/componentlibrary';
import { SpinnerIcon } from '@/componentlibrary/icons';
import { useAppDispatch, useAppSelector } from '@/store';
import { selectLoadingModalParams } from '@/store/slices/modal';
import { closeModal } from '@/store/thunks/modals';

import styles from './styles.module.less';

const LoadingModal = () => {
  const dispatch = useAppDispatch();
  const { title } = useAppSelector(selectLoadingModalParams);
  const handleClose = () => {
    dispatch(closeModal('LoadingModal'));
  };

  return (
    <Modal variant="alert" onClose={handleClose}>
      <ModalBody className={styles.body}>
        <h2>{title}</h2>
        <SpinnerIcon size="50px" />
      </ModalBody>
    </Modal>
  );
};

export default LoadingModal;
