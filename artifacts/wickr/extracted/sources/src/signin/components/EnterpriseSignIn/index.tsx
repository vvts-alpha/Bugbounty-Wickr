import { FC, FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Page from '../Page';
import PageBody from '../Page/PageBody';
import PageHeader from '../Page/PageHeader';
import PageHeaderBackButton from '../Page/PageHeader/PageHeaderBackButton';
import { Button, FormField, Heading } from '@/componentlibrary';
import { useAppTranslation } from '@/lib/i18n';
import { generateSigninRoute } from '@/signin/routes';
import { initiateLogin } from '@/signin/signinThunks';
import { useAppDispatch } from '@/store';

// TODO: Implement signin API functionality, validation and routing
const EnterpriseSignIn: FC = () => {
  const { t } = useAppTranslation();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const [emailInputValue, setEmailInputValue] = useState('');
  const [passwordInputValue, setPasswordInputValue] = useState('');

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    dispatch(initiateLogin({ email: emailInputValue, password: passwordInputValue }));
  };

  return (
    <Page>
      <PageHeader>
        <PageHeaderBackButton onClick={() => navigate(generateSigninRoute.enterpriseConfigure())} />
        <Heading level={1}>{t('Sign in')}</Heading>
      </PageHeader>
      <PageBody>
        <form onSubmit={handleSubmit}>
          <FormField
            fieldName="input"
            fieldProps={{
              showClear: false,
            }}
            label={t('Email')}
            onChange={(event) => {
              setEmailInputValue(event.target.value);
            }}
            value={emailInputValue}
          />
          <FormField
            fieldName="input"
            fieldProps={{
              showClear: false,
              type: 'password',
            }}
            label={t('Password')}
            onChange={(event) => {
              setPasswordInputValue(event.target.value);
            }}
            value={passwordInputValue}
          />
          <Button type="submit" color="primary">
            {t('Sign in')}
          </Button>
        </form>
      </PageBody>
    </Page>
  );
};

export default EnterpriseSignIn;
