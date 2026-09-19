import {
  Modal,
  ModalBody,
  ModalButtonGroup,
  ModalHeader,
  Button,
  PrimaryButton,
} from '@/componentlibrary';
import { useAppTranslation } from '@/lib/i18n';
import AppTrans from '@/lib/i18n/AppTrans';
import { useAppDispatch, useAppSelector } from '@/store';
import { selectSelfUserEmail } from '@/store/slices/identity';
import { closeModal } from '@/store/thunks/modals';

import { openLink } from '@/store/thunks/ui';

const LimitedGuestAccessModal = () => {
  const { t } = useAppTranslation();
  const dispatch = useAppDispatch();
  const myId = useAppSelector(selectSelfUserEmail);

  const handleClose = () => dispatch(closeModal('LimitedGuestAccessModal'));
  const handleLearnMore = () =>
    dispatch(
      openLink({
        link: 'https://docs.aws.amazon.com/console/wickr/guest-access',
        showConfirmation: false,
      })
    );

  return (
    <Modal variant="alert" onClose={handleClose}>
      <ModalHeader title={t('Limited guest access')} />
      <ModalBody>
        <p>
          <AppTrans
            i18nKey="Guests can't start new conversations.  Other Wickr users can now add you to their secure conversations. Let them know they can find you on Wickr using your registered email address (<0>{{myId}}</0>)."
            values={{ myId }}
          >
            <b></b>
          </AppTrans>
        </p>
      </ModalBody>
      <ModalButtonGroup>
        <Button bordered onClick={handleClose}>
          {t('Cancel')}
        </Button>
        <PrimaryButton onClick={handleLearnMore}>{t('Learn more')}</PrimaryButton>
      </ModalButtonGroup>
    </Modal>
  );
};

export default LimitedGuestAccessModal;
