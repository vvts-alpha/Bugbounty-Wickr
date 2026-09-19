import { FC } from 'react';
import Page from '../Page';
import PageBody from '../Page/PageBody';
import PageHeader from '../Page/PageHeader';
import { Button, Heading } from '@/componentlibrary';
import { useAppTranslation } from '@/lib/i18n';

import styles from './styles.module.less';

const SSOMigration: FC = () => {
  const { t } = useAppTranslation();

  const handleContinueClick = () => {
    console.log('TODO: Implement SSO Migration API here');
  };
  return (
    <Page>
      <PageHeader>
        <Heading level={1}>{t('SSO Migration')}</Heading>
      </PageHeader>
      <PageBody>
        <p>{t('Your company has migrated to an SSO (Single Sign-on) Network!')}</p>
        <div className={styles.instructionsContainer}>
          <div className={styles.instructionsItem}>
            <div className={styles.title}>{t('Use your AWS Wickr password:')}</div>
            <div>
              {t(
                'To ensure a seamless authentication, you will first enter your AWS Wickr password.'
              )}
            </div>
          </div>

          <div className={styles.instructionsItem}>
            <div className={styles.title}>{t('Enter SSO credentials:')}</div>
            <div>{t('Then, follow the prompts to enter your SSO credentials.')}</div>
          </div>
        </div>
        <Button color="primary" onClick={handleContinueClick}>
          {t('Continue')}
        </Button>
      </PageBody>
    </Page>
  );
};

export default SSOMigration;
