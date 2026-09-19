import { FC } from 'react';
import { useNavigate } from 'react-router';
import checkYourEmail from '../CheckYourEmail/check-your-email.png';
import checkYourEmail2x from '../CheckYourEmail/check-your-email@2x.png';
import Page from '../Page';
import PageBody from '../Page/PageBody';
import PageHeader from '../Page/PageHeader';
import { Button, Heading } from '@/componentlibrary';
import Picture from '@/componentlibrary/Picture';
import { useAppTranslation } from '@/lib/i18n';
import { generateSigninRoute } from '@/signin/routes';
import { selectSigninEmail } from '@/signin/signinSelectors';
import { useAppSelector } from '@/store';

// TODO: Implement signin API functionality, validation and routing
const CheckYourEmailInviteCode: FC = () => {
  const { t } = useAppTranslation();
  const navigate = useNavigate();
  // TODO: replace with actual data when available
  const email = useAppSelector(selectSigninEmail);
  return (
    <Page>
      <PageHeader>
        <Heading level={1}>{t('Check your email')}</Heading>
      </PageHeader>
      <PageBody>
        <p>
          {t(
            'Go back to the email we sent you at {{email}} and verify your account by clicking on the link in Step 2.',
            { email }
          )}
        </p>
        <Picture src={checkYourEmail} src2x={checkYourEmail2x} />
        <Button
          color="primary"
          onClick={() => navigate(generateSigninRoute.nonSSOEnterInviteCode())}
        >
          {t('Continue with invite code')}
        </Button>
      </PageBody>
    </Page>
  );
};

export default CheckYourEmailInviteCode;
