import { FC } from 'react';
import { Banner } from '@/componentlibrary';
import { useAppTranslation } from '@/lib/i18n';
import { useAppSelector } from '@/store';
import { selectConnectionStatus } from '@/store/slices/uiChat';

import styles from './styles.module.less';

interface ConnectionStatusProps {
  className?: string;
}

const ConnectionStatus: FC<ConnectionStatusProps> = () => {
  const { t } = useAppTranslation();
  const connectionStatus = useAppSelector(selectConnectionStatus);

  const shouldShow = connectionStatus === 'noConnection';

  if (!shouldShow) return null;

  return (
    <Banner severity="warning" className={styles.noNetworkStatus}>
      {t('ConnectionStatus.NoConnection')}
    </Banner>
  );
};

export default ConnectionStatus;
