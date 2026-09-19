import { FC, FormEvent, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import Page from '../Page';
import AgreementText from '../Page/AgreementText';
import PageBody from '../Page/PageBody';
import PageHeader from '../Page/PageHeader';
import PageHeaderBackButton from '../Page/PageHeader/PageHeaderBackButton';
import { FormField, Button, Checkbox, Heading } from '@/componentlibrary';
import { useAppTranslation } from '@/lib/i18n';
import { generateSigninRoute } from '@/signin/routes';
import { selectIsUserLoggedIn, selectSigninEmail } from '@/signin/signinSelectors';
import { setSigninPassword } from '@/signin/signinSlice';
import { initiateLogin } from '@/signin/signinThunks';
import { useAppDispatch, useAppSelector } from '@/store';

import { pushModal } from '@/store/slices/modal';
import styles from './styles.module.less';

const NonSSOPassword: FC = () => {
  const { t } = useAppTranslation();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const [inputValue, setInputValue] = useState('');
  // TODO: Implement remember password API here
  const [rememberPassword, setRememberPassword] = useState(false);

  const email = useAppSelector(selectSigninEmail);
  const isUserLoggedIn = useAppSelector(selectIsUserLoggedIn);

  const onChange = () => {
    setRememberPassword(!rememberPassword);
  };

  const handleBack = () => {
    if (isUserLoggedIn) {
      dispatch(pushModal({ name: 'ResetAppModal', params: { variant: 'signin' } }));
    } else {
      navigate(generateSigninRoute.landing());
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    // save the user entered password, as we may be redirected to ATO or OTP page, if so, we need to call login again with the password and the code
    dispatch(setSigninPassword(inputValue));
    dispatch(initiateLogin({ email, password: inputValue }));
  };

  return (
    <Page>
      <PageHeader>
        <PageHeaderBackButton onClick={handleBack} />
        <Heading level={1}>{t('Sign in')}</Heading>
      </PageHeader>
      <PageBody>
        <div className={styles.welcomeText}>{`${t('Welcome')} ${email}`}</div>
        <form onSubmit={handleSubmit}>
          <FormField
            fieldName="input"
            fieldProps={{
              showClear: false,
              type: 'password',
            }}
            label={t('Password')}
            onChange={(event) => {
              setInputValue(event.target.value);
            }}
            value={inputValue}
            infoContent={
              <span className={styles.checkboxLabel} onClick={onChange}>
                <Checkbox aria-label={t('Remember password')} checked={rememberPassword} />
                {t('Remember password')}
              </span>
            }
          />
          <div className={styles.forgotPasswordText}>
            <NavLink to={generateSigninRoute.nonSSOAccountRecovery()}>
              {t('Forgot password')}
            </NavLink>
          </div>
          <Button color="primary" type="submit">
            {t('Continue')}
          </Button>
        </form>
        <AgreementText />
      </PageBody>
    </Page>
  );
};

export default NonSSOPassword;
