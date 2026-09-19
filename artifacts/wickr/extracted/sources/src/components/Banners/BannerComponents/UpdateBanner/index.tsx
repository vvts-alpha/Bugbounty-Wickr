import { Banner, Button } from '@/componentlibrary';
import { useAppTranslation } from '@/lib/i18n';
import { useAppDispatch, useAppSelector } from '@/store';
import { useSetting } from '@/store/hooks/useSetting';
import { selectWickrAppName } from '@/store/slices/settings';
import { ignoreUpdate, updateApp } from '@/store/thunks/settings';

import styles from './styles.module.less';

const UpdateBanner = () => {
  const { t } = useAppTranslation();
  const dispatch = useAppDispatch();
  const updateAvailable = useSetting('updateAvailable');
  const appName = useAppSelector(selectWickrAppName);

  if (!updateAvailable) {
    return null;
  }

  const handleClose = () => {
    dispatch(ignoreUpdate());
  };
  const handleUpdate = () => {
    dispatch(updateApp());
  };

  return (
    <Banner className={styles.banner} onClose={handleClose} severity="warning">
      {t('A new version of {{appName}} is now available.', { appName })}
      <Button bordered className={styles.updateButton} onClick={handleUpdate}>
        {t('Update')}
      </Button>
    </Banner>
  );
};

export default UpdateBanner;
