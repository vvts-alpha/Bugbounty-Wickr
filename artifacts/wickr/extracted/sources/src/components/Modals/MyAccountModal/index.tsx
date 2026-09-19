import { clsx } from 'clsx';
import { useEffect } from 'react';
import {
  Button,
  CameraIcon,
  CaretIcon,
  CloseIcon,
  DeleteIcon,
  IconButton,
  LockIcon,
  Modal,
  ModalBody,
  ModalHeader,
  PresenceIcon,
  StatusIcon,
  Toggle,
  Tooltip,
} from '@/componentlibrary';
import { VerifiedIcon } from '@/componentlibrary/icons/Verified';
import { Avatar } from '@/components/Avatar';
import { useAppTranslation } from '@/lib/i18n';
import { useAppDispatch, useAppSelector } from '@/store';
import { useSelfPresenceIcon } from '@/store/hooks/useSelfPresenceIcon';
import { useSetting } from '@/store/hooks/useSetting';
import { selectSelfUser } from '@/store/slices/identity';
import { pushModal } from '@/store/slices/modal';

import { fetchUserStatus } from '@/store/thunks/identity';
import { closeModal, openModal } from '@/store/thunks/modals';
import { updatePresenceEnabled } from '@/store/thunks/settings';
import { changeProfilePicture } from '@/store/thunks/ui';

import styles from './styles.module.less';

const MyAccountModal = () => {
  const { t } = useAppTranslation();
  const dispatch = useAppDispatch();
  const selfUser = useAppSelector(selectSelfUser);
  const presenceAllowed = useSetting('presenceAllowed');
  const isPresenceEnabled = useSetting('isPresenceEnabled');
  const shouldShowPresenceIcon = useSelfPresenceIcon();
  const canChangePassword = useSetting('canChangePassword');
  const enableChangePW = useSetting('enableChangePW');
  const ssoEnabled = useSetting('ssoEnabled');
  const mlsEnabled = useSetting('mlsEnabled');

  const handleClose = () => dispatch(closeModal('MyAccountModal'));

  useEffect(() => {
    if (selfUser?.id) {
      dispatch(fetchUserStatus({ userIds: [selfUser.id] }));
    }
  }, [selfUser?.id]);

  const handleShowStatusToggle = () =>
    dispatch(updatePresenceEnabled({ enable: !isPresenceEnabled }));

  const statusText =
    selfUser &&
    (selfUser.timeIdle < 60
      ? t('Online - Active')
      : t('Online - Idle {{minutes}} minutes', {
          minutes: Math.floor(selfUser.timeIdle / 60),
        }));

  const handleReset = async () => {
    try {
      const body = t('Your avatar image will be reset to default.');
      const confirmed = await dispatch(
        openModal({ name: 'ConfirmModal', params: { title: t('Are you sure?'), body } })
      ).unwrap();
      if (confirmed) dispatch(changeProfilePicture({ remove: true }));
    } catch (error) {
      // no op
    }
  };

  return (
    <Modal variant="alert" onClose={handleClose} className={styles.modal}>
      <IconButton label={t('Close')} onClick={handleClose} className={styles.close}>
        <CloseIcon size="20px" />
      </IconButton>
      <ModalHeader title={selfUser?.name || ''} className={styles.header} />
      <ModalBody className={styles.body}>
        <div className={styles.userDetails}>
          <p aria-label={t('Account email')}>{selfUser?.id}</p>
          <Avatar userIdHash={selfUser?.idHash || ''} size="82px" className={styles.avatar} />
          <div className={clsx(styles.status, { [styles.hidden]: !shouldShowPresenceIcon })}>
            {shouldShowPresenceIcon && <PresenceIcon timeIdle={selfUser?.timeIdle || -1} />}
            <p>{statusText}</p>
          </div>
        </div>
        <div className={styles.divider} />
        <div className={styles.item}>
          <Button
            onClick={() => dispatch(changeProfilePicture())}
            className={styles.btn}
            wrapperClassName={styles.btnWrapper}
          >
            <CameraIcon filled size="24px" className={styles.icon} />
            <p className={styles.sentenceCase}>{t('Update Avatar Image')}</p>
          </Button>
          <Tooltip tip={t('Delete image')} className={styles.problemChild}>
            <IconButton
              onClick={handleReset}
              label={t('Delete image')}
              className={styles.iconBtn}
              wrapperClassName={styles.iconBtnWrapper}
            >
              <DeleteIcon className={styles.deleteIcon} height="" width="" />
            </IconButton>
          </Tooltip>
        </div>
        {canChangePassword && enableChangePW && !ssoEnabled && (
          <div className={styles.item}>
            <Button
              onClick={() => dispatch(pushModal('ChangePasswordModal'))}
              className={styles.btn}
              wrapperClassName={styles.btnWrapper}
            >
              <LockIcon filled size="24px" className={styles.icon} />
              <p className={styles.sentenceCase}>{t('Change Password')}</p>
            </Button>
          </div>
        )}
        <div className={clsx(styles.item, styles.toggleItem)}>
          <div className={styles.toggleLabel} onClick={handleShowStatusToggle}>
            <StatusIcon className={styles.icon} filledAmount="three-quarters" size="24px" />
            <p className={styles.sentenceCase}>{t('Show My Status')}</p>
          </div>
          <Toggle
            label={t('Show My Status')}
            checked={isPresenceEnabled}
            aria-disabled={!presenceAllowed}
            onChange={handleShowStatusToggle}
          />
        </div>
        {mlsEnabled && (
          <div className={styles.item}>
            <Button
              onClick={() => dispatch(pushModal('MySecurityCodeModal'))}
              className={styles.btn}
              wrapperClassName={styles.btnWrapper}
            >
              <VerifiedIcon size="24px" />
              <p>{t('My security code')}</p>
              <CaretIcon size="16px" direction="right" className={styles.caret} />
            </Button>
          </div>
        )}
      </ModalBody>
    </Modal>
  );
};

export default MyAccountModal;
