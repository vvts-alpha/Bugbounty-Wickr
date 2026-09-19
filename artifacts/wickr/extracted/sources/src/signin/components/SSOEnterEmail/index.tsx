import { FC, FormEvent, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import Page from '../Page';
import AgreementText from '../Page/AgreementText';
import PageBody from '../Page/PageBody';
import PageHeader from '../Page/PageHeader';
import PageHeaderBackButton from '../Page/PageHeader/PageHeaderBackButton';
import RegionSelector from '../RegionSelector';
import { Button, FormField, Heading } from '@/componentlibrary';
import { useAppTranslation } from '@/lib/i18n';
import { generateSigninRoute } from '@/signin/routes';
import { selectIsUserLoggedIn, selectSigninEmail } from '@/signin/signinSelectors';
import { setSigninEmail } from '@/signin/signinSlice';
import { ssoAccountHandler } from '@/signin/signinThunks';
import { useAppDispatch, useAppSelector } from '@/store';
import { pushModal } from '@/store/slices/modal';
import { emailRegex } from '@/utils/strings';

// TODO: Implement signin API functionality, validation and routing
const SSOEnterEmail: FC = () => {
  const { t } = useAppTranslation();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const [inputValue, setInputValue] = useState('');
  const [errorText, setErrorText] = useState('');
  const isUserLoggedIn = useAppSelector(selectIsUserLoggedIn);
  const autoTriggered = useRef(false);

  const email = useAppSelector(selectSigninEmail);

  // Auto-trigger SSO re-auth when user is already logged in (no need to use deeplink -> external browser login)
  useEffect(() => {
    if (isUserLoggedIn && email && !autoTriggered.current) {
      autoTriggered.current = true;
      dispatch(ssoAccountHandler(email));
    }
  }, [isUserLoggedIn, email, dispatch]);

  const handleBackButton = () => {
    if (isUserLoggedIn) {
      dispatch(pushModal({ name: 'ResetAppModal', params: { variant: 'signin' } }));
    } else {
      navigate(generateSigninRoute.landing());
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (isUserLoggedIn) {
      dispatch(ssoAccountHandler(email));
    } else {
      const trimmedInputValue = inputValue.trim();
      if (!trimmedInputValue) {
        setErrorText(t('Email is required'));
        return;
      }
      if (!emailRegex.test(trimmedInputValue)) {
        setErrorText(t('Check email and try again'));
        return;
      }
      dispatch(setSigninEmail(trimmedInputValue));
      dispatch(ssoAccountHandler(trimmedInputValue));
    }
  };

  return (
    <Page>
      <PageHeader>
        <PageHeaderBackButton onClick={handleBackButton} />
        <Heading level={1}>{t('Sign in with SSO')}</Heading>
      </PageHeader>
      <PageBody>
        {isUserLoggedIn && <div>{`${t('Welcome')} ${email}`}</div>}
        <form onSubmit={handleSubmit}>
          {!isUserLoggedIn && (
            <FormField
              fieldName="input"
              fieldProps={{
                showClear: false,
              }}
              label={t('Work email')}
              onChange={(event) => {
                setInputValue(event.target.value);
                setErrorText('');
              }}
              value={inputValue}
              hasError={!!errorText}
              errorContent={errorText}
            />
          )}
          <RegionSelector />
          <Button color="primary" type="submit">
            {t('Continue')}
          </Button>
        </form>
        <AgreementText />
      </PageBody>
    </Page>
  );
};

export default SSOEnterEmail;
