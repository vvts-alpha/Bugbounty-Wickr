import { PrimaryButton } from '@/componentlibrary';
import { useAppTranslation } from '@/lib/i18n';
import { useAppDispatch, useAppSelector } from '@/store';
import { selectActiveConvoId } from '@/store/slices/shared';
import { clearBotWarning } from '@/store/thunks/messages';

import styles from './ConvoBotWarning.module.less';

const ConvoBotWarning: React.FC = () => {
  const { t } = useAppTranslation();
  const dispatch = useAppDispatch();
  const activeConvoId = useAppSelector(selectActiveConvoId);

  const handleClick = () => {
    dispatch(clearBotWarning({ vgroupId: activeConvoId }));
  };

  return (
    <div className={styles.convoBotWarning}>
      <div className={styles.text}>
        <div className={styles.title}>{t('Bot moderator is present')}</div>
        <div className={styles.description}>
          {t(
            'A bot that is made moderator in a room or group can see all messages without being @mentioned.'
          )}
        </div>
      </div>
      <PrimaryButton onClick={handleClick} className={styles.button}>
        {t('Agree')}
      </PrimaryButton>
    </div>
  );
};

export default ConvoBotWarning;
