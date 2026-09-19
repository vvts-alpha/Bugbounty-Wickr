import { FC, FormEvent, useState } from 'react';
import Page from '../Page';
import PageBody from '../Page/PageBody';
import PageHeader from '../Page/PageHeader';
import PageHeaderBackButton from '../Page/PageHeader/PageHeaderBackButton';
import { Button, FormField, Heading } from '@/componentlibrary';
import { useAppTranslation } from '@/lib/i18n';

import { selectSigninEmail, selectSigninPassword } from '@/signin/signinSelectors';
import { initiateLogin } from '@/signin/signinThunks';
import { useAppDispatch, useAppSelector } from '@/store';
import styles from './styles.module.less';

const Signin2FA: FC = () => {
  const { t } = useAppTranslation();
  const dispatch = useAppDispatch();
  const email = useAppSelector(selectSigninEmail);
  const password = useAppSelector(selectSigninPassword);

  const [inputValue, setInputValue] = useState('');
  const [showEmptyError, setShowEmptyError] = useState(false);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (inputValue.trim().length === 0) {
      setShowEmptyError(true);
    } else {
      dispatch(initiateLogin({ email, password, code: inputValue }));
    }
  };

  return (
    <Page>
      <PageHeader>
        <PageHeaderBackButton />
        <Heading level={1}>{t('Sign in')}</Heading>
      </PageHeader>
      <PageBody>
        <form onSubmit={handleSubmit}>
          <FormField
            fieldName="input"
            fieldProps={{
              showClear: false,
            }}
            label={t('Enter verification code')}
            onChange={(event) => {
              setShowEmptyError(false);
              setInputValue(event.target.value);
            }}
            value={inputValue}
            hasError={showEmptyError}
            errorContent={t('Verification code is required')}
          />
          <p>{t('Enter the code from Google Authenticator')}</p>
          <Button type="submit" color="primary" wrapperClassName={styles.btn}>
            {t('Continue')}
          </Button>
        </form>
      </PageBody>
    </Page>
  );
};

export default Signin2FA;
