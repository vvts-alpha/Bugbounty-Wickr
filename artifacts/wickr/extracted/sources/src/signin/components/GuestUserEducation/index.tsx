import { FC } from 'react';
import { useNavigate } from 'react-router-dom';
import Page from '../Page';
import PageBody from '../Page/PageBody';
import PageHeader from '../Page/PageHeader';
import PageHeaderBackButton from '../Page/PageHeader/PageHeaderBackButton';
import {
  Button,
  GuestConvoIcon,
  GuestPlusIcon,
  GuestUpgradeIcon,
  Heading,
} from '@/componentlibrary';
import { useAppTranslation } from '@/lib/i18n';

import { generateSigninRoute } from '@/signin/routes';
import { startGuestSignUpFlow } from '@/signin/signinThunks';
import { useAppDispatch } from '@/store';
import styles from './styles.module.less';

const GuestUserEducation: FC = () => {
  const dispatch = useAppDispatch();
  const { t } = useAppTranslation();
  const navigate = useNavigate();

  const handleButtonClick = () => {
    dispatch(startGuestSignUpFlow());
  };

  return (
    <Page>
      <PageHeader>
        <PageHeaderBackButton onClick={() => navigate(generateSigninRoute.signUp())} />
        <Heading level={1}>{t('Guest access is limited')}</Heading>
      </PageHeader>
      <PageBody>
        <p>
          {t(
            "You can sign up for a guest account to collaborate with an organization's Wickr network users. Guest accounts have the following limitations:"
          )}
        </p>
        <div className={styles.guestRulesContainer}>
          <div className={styles.guestRuleItem}>
            <GuestConvoIcon size="40" />
            <div>{t("Guests can't start new conversations.")}</div>
          </div>

          <div className={styles.guestRuleItem}>
            <GuestPlusIcon size="40" />
            <div>
              {t('Wickr network users must add you to their secure conversations to chat.')}
            </div>
          </div>

          <div className={styles.guestRuleItem}>
            <GuestUpgradeIcon size="40" />
            <div>{t('Guest accounts cannot be upgraded to a Wickr network account.')}</div>
          </div>
        </div>
        <Button color="primary" onClick={handleButtonClick}>
          {t('I understand')}
        </Button>
      </PageBody>
    </Page>
  );
};

export default GuestUserEducation;
