import { FC, FormEvent, useState } from 'react';
import { useNavigate } from 'react-router';
import Page from '../Page';
import PageBody from '../Page/PageBody';
import PageHeader from '../Page/PageHeader';
import PageHeaderBackButton from '../Page/PageHeader/PageHeaderBackButton';
import { Button, FormField, Heading } from '@/componentlibrary';
import { TranslationKey, useAppTranslation } from '@/lib/i18n';
import { generateSigninRoute } from '@/signin/routes';
import { selectInviteCodeVerificationErrorMsg, selectSigninEmail } from '@/signin/signinSelectors';
import { verifyInviteCode } from '@/signin/signinThunks';
import { useAppDispatch, useAppSelector } from '@/store';

// TODO: Implement signin API functionality, validation and routing
const NonSSOEnterInviteCode: FC = () => {
  const dispatch = useAppDispatch();
  const { t } = useAppTranslation();
  const [inputValue, setInputValue] = useState('');
  const navigate = useNavigate();

  // TODO: replace with actual data when available
  const email = useAppSelector(selectSigninEmail);
  const inviteCodeVerificationErrorMsg = useAppSelector(selectInviteCodeVerificationErrorMsg);
  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    dispatch(verifyInviteCode({ email, inviteCode: inputValue }));
  };

  return (
    <Page>
      <PageHeader>
        <PageHeaderBackButton
          onClick={() => {
            navigate(generateSigninRoute.checkYourEmailInviteCode());
          }}
        />
        <Heading level={1}>{t('Enter invite code')}</Heading>
      </PageHeader>
      <PageBody>
        <p>
          {t(
            'We\'ve sent an email to you at {{email}}. Click on "register your account" to view your invite code.',
            { email }
          )}
        </p>
        <form onSubmit={handleSubmit}>
          {/* TODO: Add validation once API is implemented and code format is confirmed */}
          <FormField
            fieldName="input"
            fieldProps={{
              showClear: false,
            }}
            label={t('Enter invite code')}
            onChange={(event) => {
              setInputValue(event.target.value);
            }}
            value={inputValue}
            hasError={inviteCodeVerificationErrorMsg.length > 0}
            errorContent={t(inviteCodeVerificationErrorMsg as TranslationKey)}
          />
          <Button color="primary" type="submit">
            {t('Continue')}
          </Button>
        </form>
      </PageBody>
    </Page>
  );
};

export default NonSSOEnterInviteCode;
