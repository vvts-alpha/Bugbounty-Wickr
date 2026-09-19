import {
  Modal,
  ModalHeader,
  ModalBody,
  ModalButtonGroup,
  ModalButton,
  CautionIcon,
  List,
} from '@/componentlibrary';
import { UserRow } from '@/components/UserRow';
import { useAppTranslation } from '@/lib/i18n';
import { useAppDispatch, useAppSelector } from '@/store';
import { useUsersById } from '@/store/hooks/useUsers';
import { selectCannotAddUsersModalParams } from '@/store/slices/modal';
import { closeModal } from '@/store/thunks/modals';

import styles from './styles.module.less';

// This modal is used to communicate that some users could not be added to a room
// or group. The users may be unverifiable which usually means they have no devices
// linked to their account, or they may be unauthorized in the case of a TDF enabled
// room. Since we need to display a formatted list of user rows in this modal, we show
// this special modal instead of the SDKErrorModal which only displays an error message.
const CannotAddUsersModal = () => {
  const { t } = useAppTranslation();
  const dispatch = useAppDispatch();
  const params = useAppSelector(selectCannotAddUsersModalParams);
  const { unauthorizedUserIds = [], unverifiedUserIds = [] } = params?.errorInfo || {};
  const count = unauthorizedUserIds.length + unverifiedUserIds.length;

  const unverifiedUsers = useUsersById(unverifiedUserIds);
  const unauthorizedUsers = useUsersById(unauthorizedUserIds);

  const handleClose = () => dispatch(closeModal('CannotAddUsersModal'));

  return (
    <Modal className={styles.modal} onClose={handleClose} closeLabel={t('Close')}>
      <ModalHeader title={t('CantAddMember', { count })}></ModalHeader>
      <ModalBody className={styles.body}>
        <List className={styles.list}>
          {unauthorizedUsers.length > 0 && (
            <div className={styles.content}>
              <div className={styles.sectionHeading}>
                <CautionIcon className={styles.cautionIcon} />
                <p className={styles.sectionDescription}>
                  {t('CantAddMemberIncorrectEntitlement', { count: unauthorizedUserIds.length })}
                </p>
              </div>

              {unauthorizedUsers.map((user) => (
                <UserRow readOnly member={user} key={user.id} />
              ))}
            </div>
          )}
          {unverifiedUsers.length > 0 && (
            <div className={styles.content}>
              <div className={styles.sectionHeading}>
                <CautionIcon className={styles.cautionIcon} />
                <p className={styles.sectionDescription}>
                  {t('CantAddMemberUnverified', { count: unverifiedUserIds.length })}
                </p>
              </div>
              {unverifiedUsers.map((user) => (
                <UserRow readOnly member={user} key={user.id} />
              ))}
            </div>
          )}
        </List>
      </ModalBody>
      <ModalButtonGroup>
        <ModalButton color="primary" onClick={handleClose}>
          {t('OK')}
        </ModalButton>
      </ModalButtonGroup>
    </Modal>
  );
};

export default CannotAddUsersModal;
