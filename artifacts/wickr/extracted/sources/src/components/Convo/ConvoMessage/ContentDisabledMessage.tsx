import React from 'react';
import { LockIcon } from '@/componentlibrary';
import { useAppTranslation } from '@/lib/i18n';
import styles from './index.module.less';

const ContentDisabledMessage = () => {
  const { t } = useAppTranslation();
  return (
    <div className={styles.contentDisabledMessage}>
      <LockIcon size="1.5rem" className={styles.contentLockIcon} />
      <p>{t('Message.Content.Disabled')}</p>
    </div>
  );
};

export default ContentDisabledMessage;
