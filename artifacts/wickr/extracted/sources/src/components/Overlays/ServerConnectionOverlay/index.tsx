import {
  Heading,
  PanelOverlay,
  PrimaryButton,
  ServerConnectionIcon,
  SpinnerIcon,
} from '@/componentlibrary';
import { AppTranslationKey, useAppTranslation } from '@/lib/i18n';
import { useAppDispatch } from '@/store';
import { useSetting } from '@/store/hooks/useSetting';
import { setOverlay } from '@/store/slices/overlay';
import { ServerStatus } from '@/store/slices/settings';
import { refreshConnection } from '@/store/thunks/settings';

import styles from './styles.module.less';

type StatusToHeadingMap = {
  [key in ServerStatus]: AppTranslationKey;
};
const STATUS_TO_HEADING: StatusToHeadingMap = {
  [ServerStatus.UNKNOWN]: 'Refreshing Connection...',
  [ServerStatus.AVAILABLE]: 'Connection Status is Good!',
  [ServerStatus.UNAVAILABLE]: 'Connection Error',
};

const ServerConnectionOverlay = () => {
  const { t } = useAppTranslation();
  const dispatch = useAppDispatch();
  const currentHostStatus = useSetting('currentHostStatus');

  return (
    <PanelOverlay
      onClose={() => dispatch(setOverlay('Connectivity'))}
      closeLabel={t('Back')}
      className={styles.serverConnection}
      title={t('Server Connection')}
    >
      <div className={styles.body}>
        <ServerConnectionIcon status={currentHostStatus} />
        <Heading level={2} as="h3" className={styles.heading}>
          {t(STATUS_TO_HEADING[currentHostStatus])}
        </Heading>
        {currentHostStatus === ServerStatus.UNKNOWN ? (
          <SpinnerIcon className={styles.spinner} />
        ) : (
          <>
            <p className={styles.description}>
              {t('Try refreshing the server connection if you are experiencing network issues.')}
            </p>
            <PrimaryButton onClick={() => dispatch(refreshConnection())}>
              {t('Refresh Connection')}
            </PrimaryButton>
          </>
        )}
      </div>
    </PanelOverlay>
  );
};

export default ServerConnectionOverlay;
