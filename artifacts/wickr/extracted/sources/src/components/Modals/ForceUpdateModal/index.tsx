import {
  Button,
  ExternalLink,
  ForceUpdateIcon,
  Modal,
  ModalBody,
  ModalButtonGroup,
  ModalHeader,
  PrimaryButton,
} from '@/componentlibrary';
import { useAppTranslation } from '@/lib/i18n';
import AppTrans from '@/lib/i18n/AppTrans';
import { useAppDispatch, useAppSelector } from '@/store';
import { selectWickrAppName } from '@/store/slices/settings';

import { quitApp } from '@/store/thunks/identity';
import { updateApp } from '@/store/thunks/settings';

import styles from './styles.module.less';

const ForceUpdateModal = () => {
  const { t } = useAppTranslation();
  const dispatch = useAppDispatch();
  const appName = useAppSelector(selectWickrAppName);

  // no handleClose. We want this modal to be blocking and only allow the user to update/quit

  return (
    <Modal variant="alert">
      <ModalHeader title={t('Update {{appName}}', { appName })} />
      <ModalBody className={styles.body}>
        <p>
          {t(
            'The current version of this app is no longer supported. Please update to get the latest version.'
          )}
        </p>
        <p>
          <AppTrans i18nKey="For more information, see our <0>FAQ</0> page.">
            <ExternalLink href="https://support.wickr.com/" />
          </AppTrans>
        </p>
        <ForceUpdateIcon />
      </ModalBody>
      <ModalButtonGroup>
        <Button bordered onClick={() => dispatch(quitApp())}>
          {t('No thanks, close the app')}
        </Button>
        <PrimaryButton onClick={() => dispatch(updateApp({ force: true }))}>
          {t('Update now')}
        </PrimaryButton>
      </ModalButtonGroup>
    </Modal>
  );
};

export default ForceUpdateModal;
