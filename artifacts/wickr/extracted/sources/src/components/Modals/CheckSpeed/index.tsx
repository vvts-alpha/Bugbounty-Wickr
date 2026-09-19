import { useState } from 'react';
import { PrimaryButton, Modal, ModalBody, ModalButtonGroup, Toggle } from '@/componentlibrary';
import { useAppDispatch } from '@/store';
import { closeModal } from '@/store/thunks/modals';

import styles from './styles.module.less';

const CheckSpeedModal = () => {
  const [customTest, setCustomTest] = useState(false);
  const dispatch = useAppDispatch();
  const handleClose = () => dispatch(closeModal('CheckSpeedModal'));

  return (
    <Modal onClose={handleClose} size="lg" className={styles.modal}>
      <ModalBody className={styles.body}>
        <div className={styles.toggleContainer}>
          <span>fast.com</span>

          <Toggle
            label={customTest ? 'fast.com' : 'Custom speed test'}
            checked={customTest}
            onChange={() => setCustomTest(!customTest)}
          />
          <span>Custom speed test</span>
        </div>

        <iframe
          title="Fast.com"
          src={customTest ? 'https://main.d4zeeqgazhley.amplifyapp.com/' : 'https://fast.com'}
        />
      </ModalBody>
      <ModalButtonGroup>
        <PrimaryButton onClick={handleClose}>Close</PrimaryButton>
      </ModalButtonGroup>
    </Modal>
  );
};

export default CheckSpeedModal;
