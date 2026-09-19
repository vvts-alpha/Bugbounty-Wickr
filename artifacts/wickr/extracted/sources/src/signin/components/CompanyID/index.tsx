import { FC, FormEvent, useState } from 'react';
import { useNavigate } from 'react-router';
import Page from '../Page';
import PageBody from '../Page/PageBody';
import PageHeader from '../Page/PageHeader';
import PageHeaderBackButton from '../Page/PageHeader/PageHeaderBackButton';
import { Button, FormField, Heading } from '@/componentlibrary';
import { useAppTranslation } from '@/lib/i18n';
import { generateSigninRoute } from '@/signin/routes';
import { selectCompanyIdErrorMsg, selectSigninEmail } from '@/signin/signinSelectors';
import { setCompanyIdErrorMsg } from '@/signin/signinSlice';
import { startSSOProvision } from '@/signin/signinThunks';
import { useAppDispatch, useAppSelector } from '@/store';

// TODO: Implement signin API functionality, validation and routing
const CompanyID: FC = () => {
  const { t } = useAppTranslation();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const [inputValue, setInputValue] = useState('');
  const email = useAppSelector(selectSigninEmail);
  const companyIdErrorMsg = useAppSelector(selectCompanyIdErrorMsg);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();

    const trimmedInputValue = inputValue.trim();

    if (!trimmedInputValue) {
      dispatch(setCompanyIdErrorMsg('Company ID is required'));
      return;
    }

    dispatch(startSSOProvision({ email, companyId: trimmedInputValue }));
  };

  return (
    <Page>
      <PageHeader>
        <PageHeaderBackButton onClick={() => navigate(generateSigninRoute.ssoEnterEmail())} />
        <Heading level={1}>{t('Sign in with SSO')}</Heading>
      </PageHeader>
      <PageBody>
        <form onSubmit={handleSubmit}>
          {/* TODO: Add validation once API is implemented and code format is confirmed */}
          <FormField
            fieldName="input"
            fieldProps={{
              showClear: false,
            }}
            label={t('Company ID')}
            onChange={(event) => {
              dispatch(setCompanyIdErrorMsg(null));
              setInputValue(event.target.value);
            }}
            value={inputValue}
            hasError={!!companyIdErrorMsg}
            errorContent={t(companyIdErrorMsg ?? 'Error')}
          />
          <Button color="primary" type="submit">
            {t('Continue')}
          </Button>
        </form>
      </PageBody>
    </Page>
  );
};

export default CompanyID;
