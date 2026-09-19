import { clsx } from 'clsx';
import { useNavigate } from 'react-router';

import { Avatar } from '../Avatar';
import { useSetCoachMarkTarget } from '../CoachMarks/hooks';
import BetaMenu from '../Dev/BetaMenu';
import VersionBanner from '../Dev/VersionBanner';
import { LabNavRailButton } from '../Labs/LabNavRailButton';
import { TutorialNavRailButton } from '../Tours/TutorialNavRailButton';
import { generateChatRoute } from '@/chat/routes';
import { AddIcon, MeetingIcon, MessageIcon, MoreIcon, PresenceIcon } from '@/componentlibrary';
import { useAppTranslation } from '@/lib/i18n';
import { useAppDispatch, useAppSelector } from '@/store';
import { useFeature } from '@/store/hooks/useFeature';
import { useSelfPresenceIcon } from '@/store/hooks/useSelfPresenceIcon';
import { useSetting } from '@/store/hooks/useSetting';
import { selectSelfUser } from '@/store/slices/identity';
import { pushModal } from '@/store/slices/modal';
import { pushPanel } from '@/store/slices/panels';
import {
  selectIsMessagesViewActive,
  selectIsWickrMeetingsViewActive,
  setActiveChatView,
  selectUnreadMessagesCount,
  setActiveConvoId,
  selectIsIntegratedAppsViewActive,
} from '@/store/slices/uiChat';
import { openHamburgerMenu } from '@/store/thunks/ui';
import { NavRailButton } from './NavRailButton';
import { WickrKnowledgeBaseAIIcon } from './WickrAIChatButton';
import WickrAINavItem from './WickrAINavItem';

import styles from './styles.module.less';

const knowledgeBasePrompt =
  'You are only allowed to use information from the bedrock knowledge bases in your responses. You are not allowed to use any general information not found in a knowledege base. The region the knowledge bases are located in is `us-east-1`. Do **not** query the knowledge base if it likely contains irrelevant information. If you don\'t have enough information to answer, reply "I don\'t have enough information to answer"';

const NavRail = () => {
  const { t } = useAppTranslation();
  const theme = useSetting('theme');
  const applyTheme = () => (theme === 'classic-theme' ? 'dark-theme' : theme);
  const isMessagesView = useAppSelector(selectIsMessagesViewActive);
  const isWickrMeetingsView = useAppSelector(selectIsWickrMeetingsViewActive);
  const isIntegratedAppsView = useAppSelector(selectIsIntegratedAppsViewActive);
  const isWickrMeetingsEnabled = useFeature('WickrMeetings');
  const isIntegratedAppsEnabled = useFeature('IntegratedApps');
  const wickrAIChatEnabled = useFeature('WickrAIChat');
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const selfUser = useAppSelector(selectSelfUser);
  const timeIdle = selfUser?.timeIdle ?? -1;
  const unreadMessagesCount = useAppSelector(selectUnreadMessagesCount);
  const shouldShowPresenceIcon = useSelfPresenceIcon();
  const isProduction = useSetting('isProduction');
  const showKnowledgeBaseOnlyChat = useSetting('showKnowledgeBaseOnlyChat') && !isProduction;

  const handleMessagesClick = () => {
    if (!isMessagesView) {
      dispatch(setActiveChatView('messages'));
      navigate(generateChatRoute.landing());
    }
  };

  const handleWickrMeetingsClick = () => {
    if (!isWickrMeetingsView) {
      dispatch(setActiveChatView('wickrMeetings'));
      // Clear active convo when user switches to meeting view
      dispatch(setActiveConvoId(''));
      navigate(generateChatRoute.wickrMeeting());
    }
  };

  const handleAppsClick = () => {
    if (!isIntegratedAppsView) {
      dispatch(setActiveChatView('integratedApps'));
      dispatch(setActiveConvoId(''));
      navigate(generateChatRoute.integratedApps());
    }
  };

  const handleMoreClick = () => {
    dispatch(openHamburgerMenu());
  };

  const tourRef = useSetCoachMarkTarget('tutorial-tour', 'settings');
  const toursEnabled = useFeature('Tours');

  return (
    <nav className={clsx(applyTheme(), styles.navRailWrapper)}>
      <div className={styles.leading}>
        <NavRailButton
          label={t('Messages')}
          icon={<MessageIcon size="20" />}
          selected={isMessagesView}
          onClick={handleMessagesClick}
          className={styles.navRailButton}
          badgeCount={unreadMessagesCount}
        />
        {isWickrMeetingsEnabled && (
          <NavRailButton
            label={'Wickr Meetings'}
            icon={<MeetingIcon size="20" />}
            selected={isWickrMeetingsView}
            onClick={handleWickrMeetingsClick}
            className={styles.navRailButton}
          />
        )}
        <NavRailButton
          label={t('More')}
          icon={<MoreIcon size="20" />}
          onClick={handleMoreClick}
          className={styles.navRailButton}
          ref={tourRef}
        />
        {isIntegratedAppsEnabled && (
          <NavRailButton
            label={'Apps'}
            icon={<AddIcon size="20" />}
            selected={isIntegratedAppsView}
            onClick={handleAppsClick}
            className={styles.navRailButton}
          />
        )}
        {!isProduction && <BetaMenu />}
        {!isProduction && <LabNavRailButton />}
        {wickrAIChatEnabled && <WickrAINavItem />}
        {showKnowledgeBaseOnlyChat && (
          <NavRailButton
            label="KB Chat"
            icon={<WickrKnowledgeBaseAIIcon />}
            onClick={() =>
              dispatch(pushPanel({ name: 'WickrAIChatPanel', systemPrompt: knowledgeBasePrompt }))
            }
          />
        )}
        {toursEnabled && <TutorialNavRailButton />}
      </div>
      <div className={styles.trailing}>
        {!isProduction && <VersionBanner />}
        {selfUser && (
          <span className={styles.avatarWrapper}>
            <Avatar
              userIdHash={selfUser.idHash}
              onClick={() => {
                dispatch(pushModal('MyAccountModal'));
              }}
            />
            {shouldShowPresenceIcon && (
              <span className={styles.status}>
                <PresenceIcon timeIdle={timeIdle} />
              </span>
            )}
          </span>
        )}
      </div>
    </nav>
  );
};

export default NavRail;
