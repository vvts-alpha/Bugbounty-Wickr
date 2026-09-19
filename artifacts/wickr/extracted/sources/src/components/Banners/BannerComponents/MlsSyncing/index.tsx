import { FC } from 'react';
import { Banner } from '@/componentlibrary';
import { useAppTranslation } from '@/lib/i18n';
import { useAppSelector } from '@/store';
import { selectActiveConvoMlsSynced, selectActiveConvoIsMLS } from '@/store/slices/convos';

import styles from './styles.module.less';

const MlsSyncing: FC = () => {
  const { t } = useAppTranslation();
  const isMLS = useAppSelector(selectActiveConvoIsMLS);
  const isMLSSynced = useAppSelector(selectActiveConvoMlsSynced);

  const shouldShow = isMLS && !isMLSSynced;

  if (!shouldShow) return null;

  return (
    <Banner className={styles.mlsSyncing} severity="warning">
      {t('This room conversation is temporarily read-only. Full access will resume shortly.')}
    </Banner>
  );
};

export default MlsSyncing;
