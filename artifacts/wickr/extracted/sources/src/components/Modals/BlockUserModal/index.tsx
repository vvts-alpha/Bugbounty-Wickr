import {
  Modal,
  ModalBody,
  ModalButtonGroup,
  ModalHeader,
  Button,
  PrimaryButton,
} from '@/componentlibrary';
import { useAppTranslation } from '@/lib/i18n';
import { Logger } from '@/lib/logger';
import { useAppDispatch, useAppSelector } from '@/store';
import { useUser } from '@/store/hooks/useUsers';
import { selectBlockUserModalParams } from '@/store/slices/modal';
import { closeModal } from '@/store/thunks/modals';
import { setUserIsBlocked } from '@/store/thunks/users';

import styles from './styles.module.less';

const logger = new Logger('BlockUserModal');

const BlockUserModal = () => {
  const { t } = useAppTranslation();
  const dispatch = useAppDispatch();
  const { userIdHash } = useAppSelector(selectBlockUserModalParams);
  const user = useUser(userIdHash);

  const handleClose = () => {
    dispatch(closeModal('BlockUserModal'));
  };

  const handleSubmit = () => {
    if (!user) {
      logger.warn(`Cannot block without a valid user. userIdHash: ${userIdHash}`);
      return;
    }

    dispatch(
      setUserIsBlocked({
        block: !user.blocked,
        userHash: user.idHash,
      })
    );
    handleClose();
  };

  return (
    <Modal onClose={handleClose}>
      <ModalHeader title={t('Notice')} className={styles.title} />
      <ModalBody>
        {t(
          user?.blocked
            ? 'Are you sure you want to unblock this user?'
            : 'Are you sure you want to block this user?'
        )}
      </ModalBody>
      <ModalButtonGroup>
        <Button onClick={handleClose}>{t('Cancel')}</Button>
        <PrimaryButton onClick={handleSubmit}>
          {t(user?.blocked ? 'Unblock' : 'Block')}
        </PrimaryButton>
      </ModalButtonGroup>
    </Modal>
  );
};

export default BlockUserModal;
