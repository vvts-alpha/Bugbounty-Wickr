import { clsx } from 'clsx';
import clamp from 'lodash/clamp';
import { FormEvent, useState } from 'react';
import { useAbortableDispatch } from '../../../store/hooks/useAbortableDispatch';
import {
  Button,
  FormField,
  Modal,
  ModalBody,
  ModalButtonGroup,
  ModalHeader,
  PrimaryButton,
} from '@/componentlibrary';
import { ConvoTimeSelector } from '@/components/ConvoSettingSelectors/ConvoTimeSelector';
import { ConvoMembersModalReturnValue } from '@/components/Modals/ConvoMembersModal';
import TdfTagsContainer from '@/components/TdfTags/TagsContainer';
import useConvoExpirationTimes from '@/hooks/useConvoExpirationTimes';
import { useAppTranslation } from '@/lib/i18n';
import { useAppDispatch, useAppSelector } from '@/store';
import { useSetting } from '@/store/hooks/useSetting';
import { selectSelfUserIdHash } from '@/store/slices/identity';
import { createRoom } from '@/store/thunks/messages';
import { closeModal, openModal } from '@/store/thunks/modals';

import styles from './styles.module.less';

const NewRoomModal = () => {
  const { t } = useAppTranslation();
  const dispatch = useAppDispatch();
  const [roomTitle, setRoomTitle] = useState('');
  const [titleHasError, setTitleHasError] = useState(false);
  const [roomDescription, setRoomDescription] = useState('');
  const { minTTL, maxTTL, minBOR, maxBOR } = useConvoExpirationTimes();
  const [ttl, setTTL] = useState(maxTTL);
  const initialBOR = minBOR ? maxBOR : 0;
  const [burnOnRead, setBurnOnRead] = useState(initialBOR);
  const selfIdHash = useAppSelector(selectSelfUserIdHash);
  const abortableDispatch = useAbortableDispatch();
  const clampedTTL = clamp(ttl, minTTL, maxTTL);
  const tdfEnabled = useSetting('tdfEnabled');

  // If the minBOR and the burnOnRead selection are non-zero
  // clamp the burnOnRead within the min and max.
  // If there is a minBOR and the selection was 0,
  // set it to the maxBOR.
  const clampedBOR =
    minBOR && burnOnRead
      ? clamp(burnOnRead, minBOR, maxBOR)
      : minBOR && !burnOnRead
      ? maxBOR
      : burnOnRead;

  const expirationTimerId = 'NewRoomModal-ExpirationButton';
  const burnOnReadTimerId = 'NewRoomModal-BorButton';

  const handleUpdateTTL = (ms: number) => {
    setTTL(ms);
    // Burn on read should not be great the TTL
    if (ms < burnOnRead) setBurnOnRead(ms);
  };

  const handleClose = () => dispatch(closeModal('NewRoomModal'));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmedTitle = roomTitle.trim();
    if (trimmedTitle.length === 0) {
      setTitleHasError(true);
      return;
    }
    try {
      const convoMembersModelResult = (await abortableDispatch(
        openModal({
          name: 'ConvoMembersModal',
          params: {
            title: t('Add Members'),
            multiselect: true,
            submitButtonLabel: t('FileManagement.Create'),
            backButton: true,
          },
        })
      )) as ConvoMembersModalReturnValue | undefined;
      if (!Array.isArray(convoMembersModelResult?.members)) return;
      const membersArr: string[] = convoMembersModelResult.members;
      // need to remove self or else it breaks for accounts with only one device. QT does this too.
      const membersWithoutSelf = membersArr.filter((m) => m !== selfIdHash);
      dispatch(
        createRoom({
          members: membersWithoutSelf,
          roomTitle: trimmedTitle,
          roomDescription,
          destructionTime: clampedTTL,
          burnOnRead: clampedBOR,
        })
      );
      // Close after creating the room
      handleClose();
    } catch {
      // no-op
    }
  };

  return (
    <Modal onClose={handleClose} size="md" closeLabel={t('Close')}>
      <ModalHeader title={t('New Room')} />
      <form onSubmit={handleSubmit}>
        <ModalBody className={styles.body}>
          <FormField
            className={styles.input}
            fieldName="input"
            value={roomTitle}
            label={t('Room name')}
            onChange={(e) => {
              setTitleHasError(false);
              setRoomTitle(e.target.value);
            }}
            errorContent={t('A room name is required.')}
            hasError={titleHasError}
            fieldProps={{ showClear: false }}
          />
          <div className={styles.descriptionWrapper}>
            <FormField
              className={clsx(styles.input, styles.descriptionInput, {
                [styles.tdfEnabled]: tdfEnabled,
              })}
              fieldName="input"
              value={roomDescription}
              label={t('Room description')}
              onChange={(e) => setRoomDescription(e.target.value)}
            />
          </div>
          {tdfEnabled && (
            <TdfTagsContainer description={roomDescription} className={styles.tdfTags} />
          )}
          <ConvoTimeSelector
            convoType="room"
            expirationType="ttl"
            onChange={handleUpdateTTL}
            value={clampedTTL}
            id={expirationTimerId}
            onClickCustom={async () => {
              try {
                const value = await abortableDispatch(
                  openModal({
                    name: 'CustomConvoTimerModal',
                    params: {
                      type: 'ttl',
                      initialValue: clampedTTL,
                      originElementId: expirationTimerId,
                    },
                  })
                );
                if (typeof value === 'number') {
                  handleUpdateTTL(value);
                }
              } catch {
                // no-op
              }
            }}
          />
          <ConvoTimeSelector
            convoType="room"
            expirationType="bor"
            onChange={(val: number) => setBurnOnRead(val)}
            value={clampedBOR}
            id={burnOnReadTimerId}
            currentTTL={clampedTTL}
            onClickCustom={async () => {
              try {
                const value = await abortableDispatch(
                  openModal({
                    name: 'CustomConvoTimerModal',
                    params: {
                      type: 'bor',
                      initialValue: 0,
                      originElementId: burnOnReadTimerId,
                      currentTTL: clampedTTL,
                    },
                  })
                );
                if (typeof value === 'number') {
                  setBurnOnRead(value);
                }
              } catch {
                // no-op
              }
            }}
          />
        </ModalBody>
        <ModalButtonGroup>
          <Button bordered onClick={handleClose}>
            {t('Cancel')}
          </Button>
          <PrimaryButton type="submit">{t('Next')}</PrimaryButton>
        </ModalButtonGroup>
      </form>
    </Modal>
  );
};

export default NewRoomModal;
