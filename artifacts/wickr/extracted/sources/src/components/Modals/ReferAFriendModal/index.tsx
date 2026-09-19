import linkifyit from 'linkify-it';
import { FormEvent, useMemo, useState } from 'react';
import {
  FormField,
  Modal,
  ModalBody,
  ModalButtonGroup,
  ModalHeader,
  PrimaryButton,
} from '@/componentlibrary';
import { useAppTranslation } from '@/lib/i18n';
import { useAppDispatch, useAppSelector } from '@/store';
import { selectNetworkInvitesAllowed } from '@/store/slices/account';
import { pushModal } from '@/store/slices/modal';
import { attemptInviteUser } from '@/store/thunks/identity';
import { fetchUserById } from '@/store/thunks/messages';
import { closeModal } from '@/store/thunks/modals';

import styles from './styles.module.less';

// Only initialize once, as it puts a lot of strings into memory
let linkify: ReturnType<typeof linkifyit>;

const ReferAFriendModal = () => {
  const dispatch = useAppDispatch();
  const { t } = useAppTranslation();
  const [input, setInput] = useState('');
  const email = input.trim();
  const isValid = useMemo(() => {
    linkify ??= linkifyit();
    const res = linkify.match(email);
    // make sure the entire input is a match, and check that it is an email
    return res?.length === 1 && res[0].raw === email && res[0].schema === 'mailto:';
  }, [email]);
  const invitesAllowed = useAppSelector(selectNetworkInvitesAllowed);
  const [hasError, setHasError] = useState(false);
  const [invitationSent, setInvitationSent] = useState(false);

  const handleClose = () => {
    dispatch(closeModal('ReferAFriendModal'));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!isValid) {
      setHasError(true);
      return;
    }
    if (invitesAllowed) {
      const res = await dispatch(attemptInviteUser(email)).unwrap();
      if (!res.status) {
        if (res.errorType === 'inviteSelf') {
          setHasError(true);
        } else if (res.errorType === 'existingUser') {
          const user = await dispatch(fetchUserById(email)).unwrap();
          if (user) {
            dispatch(
              pushModal({
                name: 'UserAlreadyHasAnAccountModal',
                params: { user },
              })
            );
          }
          handleClose();
        }
      } else {
        setInvitationSent(true);
      }
    } else {
      // Refer a Friend option is currently disabled
      handleClose();
    }
  };
  return (
    <Modal onClose={handleClose} closeLabel={t('Close')}>
      <ModalHeader title={t('Invite someone by email')} />
      <form onSubmit={handleSubmit} className={styles.fullWidth}>
        <ModalBody className={styles.modalBody}>
          <FormField
            className={styles.fullWidth}
            fieldName="input"
            value={input}
            fieldProps={{
              showClear: false,
            }}
            onChange={(e) => {
              setInput(e.target.value);
              setHasError(false);
              setInvitationSent(false);
            }}
            label={t('Email')}
            hasError={hasError}
            errorContent={isValid ? t('You cannot invite yourself') : t('Invalid email')}
            infoContent={
              invitationSent ? <p className={styles.success}>{t('Invitation sent')}</p> : undefined
            }
          ></FormField>
        </ModalBody>
        <ModalButtonGroup>
          <PrimaryButton type="submit" aria-disabled={!isValid}>
            {t('Invite')}
          </PrimaryButton>
        </ModalButtonGroup>
      </form>
    </Modal>
  );
};

export default ReferAFriendModal;
