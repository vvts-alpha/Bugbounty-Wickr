import { FC } from 'react';
import Page from '../Page';
import PageBody from '../Page/PageBody';
import PageHeader from '../Page/PageHeader';
import { Heading } from '@/componentlibrary';
import Picture from '@/componentlibrary/Picture';
import { useAppTranslation } from '@/lib/i18n';
import { selectSigninEmail } from '@/signin/signinSelectors';
import { useAppSelector } from '@/store';
import checkYourEmail from './check-your-email.png';
import checkYourEmail2x from './check-your-email@2x.png';

// TODO: Implement signin API functionality, validation and routing
const CheckYourEmail: FC = () => {
  const { t } = useAppTranslation();
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
            "We've sent an email to you at {{email}}. Verify your account using the link in the email.",
            { email }
          )}
        </p>
        <p>{t('Return to this screen after you click on the link.')}</p>
        <Picture src={checkYourEmail} src2x={checkYourEmail2x} />
      </PageBody>
    </Page>
  );
};

export default CheckYourEmail;
