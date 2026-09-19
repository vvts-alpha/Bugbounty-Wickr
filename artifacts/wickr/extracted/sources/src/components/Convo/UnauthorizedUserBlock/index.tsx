import { Button } from '@/componentlibrary';
import { useAppTranslation } from '@/lib/i18n';
import { useAppDispatch } from '@/store';
import { pushPanel } from '@/store/slices/panels';

import styles from './UnauthorizedUserBlock.module.less';

export const UnauthorizedUserBlock = () => {
  const { t } = useAppTranslation();
  const dispatch = useAppDispatch();

  const handleViewUsersClick = () => {
    dispatch(pushPanel({ name: 'ViewUsersPanel' }));
  };

  return (
    <div className={styles.container}>
      <div className={styles.content}>
        <div className={styles.textContent}>
          <h3 className={styles.title}>{t('Unauthorized user in room')}</h3>
          <p className={styles.message}>
            {t(
              'An unauthorized user is present in the room. Messages cannot be sent until the user is removed by a moderator.'
            )}
          </p>
        </div>
        <Button onClick={handleViewUsersClick} color="primary">
          {t('View Users')}
        </Button>
      </div>
    </div>
  );
};
