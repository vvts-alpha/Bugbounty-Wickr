import { FC, FormEvent, useState } from 'react';
import { useNavigate } from 'react-router';
import Page from '../Page';
import PageBody from '../Page/PageBody';
import PageHeader from '../Page/PageHeader';
import PageHeaderBackButton from '../Page/PageHeader/PageHeaderBackButton';
import { Button, FormField, Heading } from '@/componentlibrary';
import { useAppTranslation } from '@/lib/i18n';
import { generateSigninRoute } from '@/signin/routes';
import { selectPasswordRegistrationErrorMsg } from '@/signin/signinSelectors';
import { registerWithPassword } from '@/signin/signinThunks';
import { useAppDispatch, useAppSelector } from '@/store';
import { useSetting } from '@/store/hooks/useSetting';

// TODO: Implement signin API functionality, validation and routing
const NonSSOCreatePassword: FC = () => {
  const { t } = useAppTranslation();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const [passwordInputValue, setPasswordInputValue] = useState('');
  const [confirmInputValue, setConfirmInputValue] = useState('');
  // logic reference: https://code.amazon.com/packages/WickrDesktopApp/blobs/ab09c44572cf456ec7067854a7adb5b5b7ec7766/--/clients/enterprise/qml/AWSWickrProOnBoarding/CreatePassword.qml#L37
  const minLen = useSetting('passwordMinLen');
  const minLower = useSetting('passwordLowercase');
  const minUpper = useSetting('passwordUppercase');
  const minNumbers = useSetting('passwordNumbers');
  const minSymbols = useSetting('passwordSymbols');
  const [unmetRequirements, setUnmetRequirements] = useState('');
  const passwordRegistrationErrorMsg = useAppSelector(selectPasswordRegistrationErrorMsg);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const lowerCount = (passwordInputValue.match(/[a-z]/g) || []).length;
    const upperCount = (passwordInputValue.match(/[A-Z]/g) || []).length;
    const numberCount = (passwordInputValue.match(/[0-9]/g) || []).length;
    const symbolCount = (passwordInputValue.match(/[^A-Za-z0-9]/g) || []).length;
    const errors = [];
    if (passwordInputValue.length < minLen) {
      errors.push(t('Enter {{minLen}} or more characters', { minLen }));
    }
    if (lowerCount < minLower) {
      errors.push(t('Must contain at least {{count}} lowercase character', { count: minLower }));
    }

    if (upperCount < minUpper) {
      errors.push(t('Must contain at least {{count}} uppercase character', { count: minUpper }));
    }

    if (numberCount < minNumbers) {
      errors.push(t('Must contain at least {{count}} number', { count: minNumbers }));
    }

    if (symbolCount < minSymbols) {
      errors.push(t('Must contain at least {{count}} special character', { count: minSymbols }));
    }

    if (errors.length > 0) {
      setUnmetRequirements(errors.join('. '));
      return;
    }

    dispatch(registerWithPassword(passwordInputValue));
  };

  const shouldShowError = (confirmInput: string, passwordInput: string) =>
    confirmInput.length >= passwordInput.length && confirmInput !== passwordInput;

  return (
    <Page>
      <PageHeader>
        <PageHeaderBackButton onClick={() => navigate(generateSigninRoute.landing())} />
        <Heading level={1}>{t('Create a password')}</Heading>
      </PageHeader>
      <PageBody>
        <form onSubmit={handleSubmit}>
          <FormField
            fieldName="input"
            fieldProps={{
              showClear: false,
              type: 'password',
            }}
            label={t('Password')}
            onChange={(event) => {
              setUnmetRequirements('');
              setPasswordInputValue(event.target.value);
            }}
            value={passwordInputValue}
            hasError={unmetRequirements.length > 0}
            errorContent={unmetRequirements}
          />
          <FormField
            fieldName="input"
            fieldProps={{
              showClear: false,
              type: 'password',
            }}
            label={t('Confirm password')}
            onChange={(event) => {
              setConfirmInputValue(event.target.value);
            }}
            value={confirmInputValue}
            hasError={
              shouldShowError(confirmInputValue, passwordInputValue) ||
              !!passwordRegistrationErrorMsg
            }
            errorContent={
              shouldShowError(confirmInputValue, passwordInputValue)
                ? t('The passwords do not match')
                : t(passwordRegistrationErrorMsg ?? 'Error')
            }
          />
          <Button type="submit" color="primary">
            {t('Continue')}
          </Button>
        </form>
      </PageBody>
    </Page>
  );
};

export default NonSSOCreatePassword;
