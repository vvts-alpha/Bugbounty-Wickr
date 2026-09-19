import { FC, FormEvent, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import Page from '../Page';
import AgreementText from '../Page/AgreementText';
import PageBody from '../Page/PageBody';
import PageHeader from '../Page/PageHeader';
import SeparatorText from '../Page/SeparatorText';
import RegionSelector from '../RegionSelector';
import { Button, FormField, Heading } from '@/componentlibrary';
import { useAppTranslation } from '@/lib/i18n';
import { generateSigninRoute } from '@/signin/routes';

import { selectCheckUserExistsErrorMsg } from '@/signin/signinSelectors';
import { setCheckUserExistsErrorMsg, setSigninEmail } from '@/signin/signinSlice';
import { checkUserExists } from '@/signin/signinThunks';
import { useAppDispatch, useAppSelector } from '@/store';
import styles from './styles.module.less';

// TODO: Implement signin API functionality, validation and routing
const Landing: FC = () => {
  const dispatch = useAppDispatch();
  const { t } = useAppTranslation();
  const navigate = useNavigate();
  const [inputValue, setInputValue] = useState('');
  const checkUserExistsErrorMsg = useAppSelector(selectCheckUserExistsErrorMsg);

  const handleSigninWithEmail = (e: FormEvent) => {
    e.preventDefault();
    dispatch(setCheckUserExistsErrorMsg(null));
    dispatch(setSigninEmail(inputValue));
    dispatch(checkUserExists({ email: inputValue }));
  };

  return (
    <Page>
      <PageHeader>
        <Heading level={1}>{t('Sign in to your Wickr network')}</Heading>
      </PageHeader>
      <PageBody>
        <Button
          className={styles.ssoButton}
          color="primary"
          onClick={() => navigate(generateSigninRoute.ssoEnterEmail())}
        >
          {t('Sign in with SSO')}
        </Button>
        <SeparatorText text={t('Or, use email address')} />
        <form onSubmit={handleSigninWithEmail}>
          <FormField
            fieldName="input"
            fieldProps={{
              showClear: false,
              placeholder: t('name@email.com'),
            }}
            label={t('Email')}
            onChange={(event) => {
              dispatch(setCheckUserExistsErrorMsg(null));
              setInputValue(event.target.value);
            }}
            value={inputValue}
            hasError={!!checkUserExistsErrorMsg}
            errorContent={t(checkUserExistsErrorMsg ?? 'Error')}
          />
          <RegionSelector />
          <Button className={styles.emailButton} color="primary" type="submit">
            {t('Sign in with email')}
          </Button>
        </form>
        <AgreementText />
      </PageBody>
      <footer className={styles.footer}>
        {t("Don't have an account?")}{' '}
        <NavLink to={generateSigninRoute.signUp()}>{t('Sign up')}</NavLink>
      </footer>
    </Page>
  );
};

export default Landing;
