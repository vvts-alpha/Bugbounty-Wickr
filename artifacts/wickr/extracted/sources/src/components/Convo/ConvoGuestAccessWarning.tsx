import { useAppTranslation } from '@/lib/i18n';

import styles from './ConvoGuestAccessWarning.module.less';

const ConvoGuestAccessWarning: React.FC = () => {
  const { t } = useAppTranslation();

  return (
    <div className={styles.convoGuestAccessWarning}>
      <b>{t('Limited guest access.')}</b> {t('Wickr network users must be present in the group.')}{' '}
      <a href="https://docs.aws.amazon.com/console/wickr/guest-access">{t('Learn more')}</a>
    </div>
  );
};

export default ConvoGuestAccessWarning;
