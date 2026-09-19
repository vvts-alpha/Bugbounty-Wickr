import { FC } from 'react';
import { useNavigate } from 'react-router-dom';
import Page from '../Page';
import PageBody from '../Page/PageBody';
import PageHeader from '../Page/PageHeader';
import PageHeaderBackButton from '../Page/PageHeader/PageHeaderBackButton';
import { Button, Heading } from '@/componentlibrary';
import { useAppTranslation } from '@/lib/i18n';
import { generateSigninRoute } from '@/signin/routes';
import { selectSigninEmail } from '@/signin/signinSelectors';
import { resetPassword } from '@/signin/signinThunks';
import { useAppDispatch, useAppSelector } from '@/store';

// TODO: Implement signin API functionality, validation and routing
const NonSSOAccountRecovery: FC = () => {
  const { t } = useAppTranslation();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const email = useAppSelector(selectSigninEmail);

  const handleClick = () => {
    dispatch(resetPassword(email));
  };

  return (
    <Page>
      <PageHeader>
        <PageHeaderBackButton onClick={() => navigate(generateSigninRoute.nonSSOPassword())} />
        <Heading level={1}>{t('Account recovery')}</Heading>
      </PageHeader>
      <PageBody>
        <p>
          {t(
            'For your protection, resetting your password will delete your contacts and content in rooms and convos across all your devices associated with your account.'
          )}
        </p>
        <Button color="primary" onClick={handleClick}>
          {t('Reset password')}
        </Button>
      </PageBody>
    </Page>
  );
};

export default NonSSOAccountRecovery;
