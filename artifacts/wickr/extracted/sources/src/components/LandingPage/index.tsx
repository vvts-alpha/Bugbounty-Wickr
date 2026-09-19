import { useSetCoachMarkTarget } from '../CoachMarks/hooks';
import { ComposeIcon, IconButton, SearchStarIcon } from '@/componentlibrary';
import { useAppTranslation } from '@/lib/i18n';
import AppTrans from '@/lib/i18n/AppTrans';
import { useAppDispatch, useAppSelector } from '@/store';
import { useSetting } from '@/store/hooks/useSetting';
import { selectSelfUser } from '@/store/slices/identity';
import { openSearchPopout } from '@/store/thunks/ui';

import styles from './styles.module.less';

const LandingPage: React.FC = () => {
  const { t } = useAppTranslation();
  const selfUser = useAppSelector(selectSelfUser);
  const dispatch = useAppDispatch();
  const isEnterprise = useSetting('isEnterprise');
  const isGovCloudEnabled = useSetting('isGovCloudEnabled');

  const handleOpenSearchPopout = () => {
    dispatch(openSearchPopout());
  };

  const getWelcomeTitle = () => {
    if (selfUser?.isGuest) {
      return t('LandingPage.WelcomeTitleGuest');
    } else if (isEnterprise) {
      return t('LandingPage.WelcomeTitleEnterprise');
    } else if (isGovCloudEnabled) {
      return t('LandingPage.WelcomeTitleGov');
    }
    return t('LandingPage.WelcomeTitle');
  };

  const tourRef = useSetCoachMarkTarget('tutorial-tour', 'search');

  return (
    <div className={styles.landingPage}>
      <IconButton
        wrapperClassName={styles.searchIcon}
        onClick={handleOpenSearchPopout}
        label={t('Conversations.ConvoHeader.GlobalSearch')}
        ref={tourRef}
      >
        <SearchStarIcon filled size="20px" />
      </IconButton>

      <div className={styles.welcome}>
        {getWelcomeTitle()}

        <div className={styles.message}>
          {selfUser?.isGuest ? (
            t('LandingPage.WelcomeMessageGuest', { email: selfUser?.id })
          ) : (
            <AppTrans i18nKey="To start a secure conversation with your Wickr contacts, click on the new message icon <0>{{icon}}</0>.">
              <ComposeIcon aria-hidden={true} />
            </AppTrans>
          )}
        </div>
      </div>
    </div>
  );
};

export default LandingPage;
