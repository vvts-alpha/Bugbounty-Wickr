import { FC } from 'react';
import { useNavigate } from 'react-router-dom';
import Page from '../Page';
import PageBody from '../Page/PageBody';
import PageHeader from '../Page/PageHeader';
import PageHeaderBackButton from '../Page/PageHeader/PageHeaderBackButton';
import { Button, Heading, GuestIcon, OrgIcon, CaretIcon } from '@/componentlibrary';
import { useAppTranslation } from '@/lib/i18n';
import { generateSigninRoute } from '@/signin/routes';
import { useAppDispatch } from '@/store';
import { openLink } from '@/store/thunks/ui';

import styles from './styles.module.less';
import pageStyles from '../Page/styles.module.less';

// TODO: Implement signin API functionality, validation and routing
const SignUp: FC = () => {
  const { t } = useAppTranslation();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  return (
    <Page>
      <PageHeader>
        <PageHeaderBackButton onClick={() => navigate(generateSigninRoute.landing())} />
        <Heading level={1}>{t('Get started with Wickr')}</Heading>
      </PageHeader>
      <PageBody>
        <Button
          bordered
          className={pageStyles.fullBodyWidth}
          onClick={() => navigate(generateSigninRoute.guestUserEducation())}
        >
          <div className={styles.buttonContent}>
            <GuestIcon size="40" />
            <div className={styles.buttonText}>
              <div className={styles.title}>{t('Create a personal guest account')}</div>
              <div className={styles.description}>
                {t('Use your guest account to collaborate with organizations using Wickr.')}
              </div>
            </div>
            <CaretIcon direction="right" />
          </div>
        </Button>
        <Button
          bordered
          className={pageStyles.fullBodyWidth}
          onClick={() => {
            dispatch(openLink({ link: 'https://aws.amazon.com/wickr/', showConfirmation: true }));
          }}
        >
          <div className={styles.buttonContent}>
            <OrgIcon size="40" />
            <div className={styles.buttonText}>
              <div className={styles.title}>{t('Setup Wickr for your organization')}</div>
              <div className={styles.description}>
                {t('Use your AWS account to manage secure communications for your organization.')}
              </div>
            </div>
            <CaretIcon direction="right" />
          </div>
        </Button>
      </PageBody>
    </Page>
  );
};

export default SignUp;
