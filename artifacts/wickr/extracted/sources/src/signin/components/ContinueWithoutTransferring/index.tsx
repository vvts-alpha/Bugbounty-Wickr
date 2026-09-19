import { FC } from 'react';
import { useNavigate } from 'react-router';
import Page from '../Page';
import PageBody from '../Page/PageBody';
import PageHeader from '../Page/PageHeader';
import PageHeaderBackButton from '../Page/PageHeader/PageHeaderBackButton';
import { Button, Heading } from '@/componentlibrary';
import { useAppTranslation } from '@/lib/i18n';

import { generateSigninRoute } from '@/signin/routes';
import { useAppDispatch } from '@/store';
import { pushModal } from '@/store/slices/modal';
import styles from './styles.module.less';
import pageStyles from '../Page/styles.module.less';

const ContinueWithoutTransferring: FC = () => {
  const dispatch = useAppDispatch();
  const { t } = useAppTranslation();
  const navigate = useNavigate();

  const handleResetAccount = () => {
    dispatch(pushModal('ResetAccountModal'));
  };
  return (
    <Page>
      <PageHeader>
        <PageHeaderBackButton onClick={() => navigate(generateSigninRoute.transferData())} />
        <Heading level={1}>{t('Continue without transferring')}</Heading>
      </PageHeader>
      <PageBody>
        <Button
          className={pageStyles.fullBodyWidth}
          color="transparent"
          bordered
          onClick={() => navigate(generateSigninRoute.recoverYourAccount())}
        >
          <div className={styles.buttonContent}>
            <Heading level={1}>{t('Use master recovery key')}</Heading>
            <p>
              {t(
                'Restore your account using the master recovery received during account creation.'
              )}
            </p>
          </div>
        </Button>
        <Button
          onClick={handleResetAccount}
          className={pageStyles.fullBodyWidth}
          color="transparent"
          bordered
        >
          <div className={styles.buttonContent}>
            <Heading level={1}>{t('Reset account')}</Heading>
            <p>
              {t(
                'Resetting your account will delete your message history and contacts across all of your devices.'
              )}
            </p>
          </div>
        </Button>
      </PageBody>
    </Page>
  );
};

export default ContinueWithoutTransferring;
