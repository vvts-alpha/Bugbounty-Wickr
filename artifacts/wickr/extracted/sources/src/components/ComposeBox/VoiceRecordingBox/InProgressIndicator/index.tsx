import React from 'react';
import { useAppTranslation } from '@/lib/i18n';
import styles from './InProgressIndicator.module.less';

const InProgressIndicator: React.FC = () => {
  const { t } = useAppTranslation();
  return (
    <div role="progressbar" aria-label={t('Compose.VoiceRecordingBox.InProgressIndicator')}>
      <span className={styles.dot} />
      <span className={styles.dot} />
      <span className={styles.dot} />
      <span className={styles.dot} />
      <span className={styles.dot} />
    </div>
  );
};

export default InProgressIndicator;
