import { FC } from 'react';
import { Button, Modal, ModalBody, ModalHeader } from '@/componentlibrary';
import { LiveLocationContentLabel } from '@/components/Convo/ConvoMessageLocationContent';
import { GeoLocationMap } from '@/components/Convo/MessageContent/GeoLocationMap';
import { useAppTranslation } from '@/lib/i18n';
import { useAppDispatch, useAppSelector, useAppSelectorExtra } from '@/store';
import { selectConvoMessage } from '@/store/slices/convos';
import { selectSelfUser } from '@/store/slices/identity';
import {
  LocationModalForwardedParams,
  LocationModalShareParams,
  LocationModalViewParams,
  selectLocationModalParams,
} from '@/store/slices/modal';
import { selectUserByIdHash } from '@/store/slices/users';
import { closeModal } from '@/store/thunks/modals';
import { getContactDisplayName } from '@/utils/strings';
import styles from './styles.module.less';

const LocationModal = () => {
  const params = useAppSelector(selectLocationModalParams);
  const { type } = params;

  if (type === 'view') {
    return <ViewLocationModalContent {...params} />;
  }
  if (type === 'forwarded') {
    return <ForwardedLocationModalContent {...params} />;
  }
  if (type === 'share') {
    return <ShareLocationModalContent {...params} />;
  }
};

// Modal used for viewing someone's location from a chat message
const ViewLocationModalContent: FC<LocationModalViewParams> = ({ msgId, vGroupId }) => {
  const { t } = useAppTranslation();
  const dispatch = useAppDispatch();
  const message = useAppSelectorExtra(selectConvoMessage, vGroupId, msgId);
  const sender = useAppSelectorExtra(selectUserByIdHash, message?.senderHash ?? '');
  const senderName = getContactDisplayName(sender);
  const location = message?.location;
  const lastUpdated = message?.editTimestamp ?? message?.timeStamp;

  const handleClose = () => {
    dispatch(closeModal('LocationModal'));
  };

  if (!message || !location) {
    return null;
  }

  return (
    <Modal onClose={handleClose} size="xl" closeLabel={t('Close')}>
      <ModalHeader>
        <div>
          <h1 className={styles.title}>
            {t(`{{name}}'s Location`, {
              name: senderName,
            })}
          </h1>
          {!!location?.shareExpiration && lastUpdated && (
            <LiveLocationContentLabel
              lastUpdated={lastUpdated}
              shareExpiration={location.shareExpiration}
            />
          )}
        </div>
      </ModalHeader>
      <ModalBody className={styles.body}>
        <GeoLocationMap {...location} senderName={senderName} />
      </ModalBody>
    </Modal>
  );
};

const ForwardedLocationModalContent: FC<LocationModalForwardedParams> = ({ message }) => {
  const dispatch = useAppDispatch();
  const { t } = useAppTranslation();

  const { location } = message;

  const handleClose = () => {
    dispatch(closeModal('LocationModal'));
  };

  return (
    <Modal onClose={handleClose} size="xl" closeLabel={t('Close')}>
      <ModalHeader>
        <h1 className={styles.title}>{t('Forwarded Location')}</h1>
      </ModalHeader>
      <ModalBody className={styles.body}>
        <GeoLocationMap {...location} />
      </ModalBody>
    </Modal>
  );
};

// Modal used to confirm the current user's location before sharing it
const ShareLocationModalContent: FC<LocationModalShareParams> = ({ location }) => {
  const { t } = useAppTranslation();
  const dispatch = useAppDispatch();
  const selfUser = useAppSelector(selectSelfUser);
  const senderName = getContactDisplayName(selfUser);

  const handleClose = () => {
    dispatch(closeModal('LocationModal'));
  };

  const handleSubmitLocation = () => {
    dispatch(
      closeModal({
        name: 'LocationModal',
        returnValue: location,
      })
    );
  };

  return (
    <Modal onClose={handleClose} size="xl" closeLabel={t('Close')}>
      <ModalHeader>
        <h1>{t('Share Location')}</h1>
      </ModalHeader>
      <ModalBody className={styles.shareBody}>
        <GeoLocationMap
          latitude={location.latitude}
          longitude={location.longitude}
          senderName={senderName}
        />
        <div className={styles.buttons}>
          <Button bordered onClick={handleClose}>
            {t('Cancel')}
          </Button>
          <Button color="primary" onClick={handleSubmitLocation}>
            {t('Share Location')}
          </Button>
        </div>
      </ModalBody>
    </Modal>
  );
};

export default LocationModal;
