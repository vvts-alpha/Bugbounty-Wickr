import { FC, FormEvent, useState } from 'react';
import { useNavigate } from 'react-router';
import Page from '../Page';
import PageBody from '../Page/PageBody';
import PageHeader from '../Page/PageHeader';
import PageHeaderBackButton from '../Page/PageHeader/PageHeaderBackButton';
import { Button, FormField, Heading } from '@/componentlibrary';
import { useAppTranslation } from '@/lib/i18n';
import { generateSigninRoute } from '@/signin/routes';

import { selectSigninEmail, selectSigninPassword } from '@/signin/signinSelectors';
import { initiateLogin, requestEmailATOCode, resendATOCode } from '@/signin/signinThunks';
import { useAppDispatch, useAppSelector } from '@/store';
import styles from './styles.module.less';

// TODO: Implement signin API functionality, validation and routing
const VerifyDevice: FC = () => {
  const { t } = useAppTranslation();
  const dispatch = useAppDispatch();
  const [inputValue, setInputValue] = useState('');
  const navigate = useNavigate();

  // Replace state below once API is available
  const [verifyingWithEmail, setVerifyingWithEmail] = useState(false);

  const email = useAppSelector(selectSigninEmail);
  const password = useAppSelector(selectSigninPassword);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    dispatch(initiateLogin({ email, password, code: inputValue }));
  };

  const handleResendCode = () => {
    dispatch(resendATOCode());
  };

  const handleVerifyUsingEmail = () => {
    dispatch(requestEmailATOCode());
    setVerifyingWithEmail(true);
  };

  return (
    <Page>
      <PageHeader>
        <PageHeaderBackButton
          onClick={() => {
            navigate(generateSigninRoute.nonSSOPassword());
          }}
        />
        <Heading level={1}>{t('Verify device')}</Heading>
      </PageHeader>
      <PageBody>
        {verifyingWithEmail ? (
          <p>
            {t(
              'We have sent an email with verification code to {{email}}. Enter the code to continue.',
              { email }
            )}
          </p>
        ) : (
          <p>
            {t(
              'We sent a notification with a verification code to your other devices. Open the app on one of these devices and get the code to proceed.'
            )}
          </p>
        )}
        <form onSubmit={handleSubmit}>
          {/* TODO: Add validation once API is implemented and recovery key format is confirmed */}
          <FormField
            fieldName="input"
            fieldProps={{
              showClear: false,
            }}
            label={t('Enter verification code')}
            onChange={(event) => {
              setInputValue(event.target.value);
            }}
            value={inputValue}
          />
          <div className={styles.optionsContainer}>
            <Button className={styles.optionButton} onClick={handleResendCode}>
              {t('Resend code')}
            </Button>
            <Button className={styles.optionButton} onClick={handleVerifyUsingEmail}>
              {t('Verify using email')}
            </Button>
          </div>
          <Button type="submit" color="primary">
            {t('Submit')}
          </Button>
        </form>
      </PageBody>
    </Page>
  );
};

export default VerifyDevice;
