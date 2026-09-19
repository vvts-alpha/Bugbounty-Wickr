import { ContactBackup } from '@amzn/wickr-messaging-protocol-proto';
import { clsx } from 'clsx';
import { FC } from 'react';
import { convoHeaderTabMap } from '..';
import {
  CaretIcon,
  SearchStarIcon,
  GridGlobeIcon,
  PhoneIcon,
  FolderIcon,
  InformationIcon,
  AvatarGroupIcon,
  AvatarPairIcon,
  Button,
  IconButton,
  Tab,
  Tabs,
  LinkIcon,
  TagIcon,
  SpinnerIcon,
  Badge,
  PopOver,
  PopOverItem,
  RetryIcon,
  DeleteIcon,
  VerifiedIcon,
} from '@/componentlibrary';
import { useSetCoachMarkTarget } from '@/components/CoachMarks/hooks';
import { withErrorBoundary } from '@/components/Errors/withErrorBoundary';
import { KeyboardShortcut } from '@/components/KeyboardShortcut';
import Tag from '@/components/TdfTags/Tag';
import { useAppTranslation } from '@/lib/i18n';
import { WickrConvoType } from '@/lib/protobuf/convos';
import { useAppSelector, useAppDispatch } from '@/store';
import { useFeature } from '@/store/hooks/useFeature';
import { useSetting } from '@/store/hooks/useSetting';
import { selectIsCallShuttingDown, selectSelfCallStatus } from '@/store/slices/calls';
import {
  selectActiveConvoType,
  selectActiveConvoTitle,
  selectActiveConvoDescription,
  selectActiveConvoOtherMembers,
  selectActiveConvoSelfMember,
  selectActiveConvoExternalMembers,
  selectActiveConvoBotMembers,
  selectActiveConvoActiveCall,
  selectActiveConvoNonGuestMembersCount,
  selectActiveConvoGuardTagColor,
  selectActiveConvoGuardText,
  selectActiveConvoIsMLS,
  selectActiveConvoWebAppLoaded,
  selectActiveConvoHasUnauthorizedMembers,
  selectActiveConvoShortenedTdfTags,
} from '@/store/slices/convos';
import { selectActiveConvoId } from '@/store/slices/shared';
import { viewRoomDetails, joinCall, openSavedItems, mlsAction } from '@/store/thunks/convos';
import { openAlertModal } from '@/store/thunks/modals';
import { handleStartCall, openSearchPopout, viewContactDetails } from '@/store/thunks/ui';
import { getContactDisplayName, raw } from '@/utils/strings';

import styles from './ConvoHeader.module.less';

interface ConvoHeaderProps {
  onSelectTab?: (index: number) => void;
  selectedTab: number;
}

const ConvoHeaderImpl: FC<ConvoHeaderProps> = ({ onSelectTab, selectedTab }) => {
  const { t } = useAppTranslation();
  const dispatch = useAppDispatch();
  const vgroupId = useAppSelector(selectActiveConvoId);
  const selfMember = useAppSelector(selectActiveConvoSelfMember);
  const nonGuestMembersCount = useAppSelector(selectActiveConvoNonGuestMembersCount);
  const otherMembers = useAppSelector(selectActiveConvoOtherMembers);
  const externalMembers = useAppSelector(selectActiveConvoExternalMembers);
  const botMembers = useAppSelector(selectActiveConvoBotMembers);
  const convoType = useAppSelector(selectActiveConvoType);
  const convoTitle = useAppSelector(selectActiveConvoTitle);
  const convoDescription = useAppSelector(selectActiveConvoDescription);
  const activeCall = useAppSelector(selectActiveConvoActiveCall);
  const selfCallStatus = useAppSelector(selectSelfCallStatus);
  const isCallShuttingDown = useAppSelector(selectIsCallShuttingDown);
  const isMLSConvo = useAppSelector(selectActiveConvoIsMLS);
  const isFileManagementEnabled = useFeature('FileManagement');
  const hasUnauthorizedMembers = useAppSelector(selectActiveConvoHasUnauthorizedMembers);

  const showSecurityTag = useSetting('guardEnabled');
  const securityTagColor = useAppSelector(selectActiveConvoGuardTagColor);
  const securityTagName = useAppSelector(selectActiveConvoGuardText) || t('No priority tag set');
  const activeConvoWebAppLoaded = useAppSelector(selectActiveConvoWebAppLoaded);
  const shortenedTdfTags = useAppSelector(selectActiveConvoShortenedTdfTags);
  const tdfEnabled = useSetting('tdfEnabled');

  const isConvoTypeDM = convoType === WickrConvoType.DM;
  const isConvoTypeGroup = convoType === WickrConvoType.Group;
  const filesEnabled = useSetting('filesEnabled');
  const shouldShowFileManagement = !isConvoTypeDM && isFileManagementEnabled && filesEnabled;
  const canStart11Call = useSetting('canStart11Call');
  const canStartGroupCall = useSetting('canStartGroupCall');
  const canStartRoomCall = useSetting('canStartRoomCall');
  const isBeta = useSetting('isBeta');
  let canStartCall;
  if (isConvoTypeDM) {
    canStartCall = canStart11Call;
  } else if (isConvoTypeGroup) {
    canStartCall = canStartGroupCall;
  } else {
    canStartCall = canStartRoomCall;
  }
  const isProd = useSetting('isProduction');

  const renderConvoTitle = () => {
    if (isConvoTypeGroup) {
      // Only show "All members have left" when members of a group have previously loaded and all except self user has left
      // We can know that members have loaded when selfMember is not undefined
      if (!otherMembers.length && selfMember) {
        return t('All members have left');
      }

      if (convoTitle) {
        return convoTitle;
      } else if (otherMembers.length) {
        const members = otherMembers
          .map((member) => {
            return getContactDisplayName(member);
          })
          .sort()
          .join(', ');

        return members;
      }
    }

    // The title already accounts for user name customizations
    return convoTitle || <SpinnerIcon />;
  };

  const allMembersCount = (otherMembers?.length || 0) + 1;

  const botMembersCount = botMembers?.length || 0;

  const externalMemberCount = externalMembers?.length || 0;

  const TitleIcon: FC = () => {
    const hasExternal = externalMemberCount > 0;
    const size = '24px';

    // Guest users should not see external globe icons
    if (hasExternal && !selfMember?.isGuest) {
      return <GridGlobeIcon size="19px" className={styles.externalIcon} filled />;
    }

    // TODO confirm product wants to show the Avatar for DM headers
    // if (isConvoTypeDM) {
    //   return <Avatar userIdHash={otherMembers[0]?.idHash} />;
    // }

    if (convoType === WickrConvoType.Room) {
      return <AvatarGroupIcon size={size} filled />;
    }

    if (convoType === WickrConvoType.Group) {
      return <AvatarPairIcon size={size} filled />;
    }

    return null;
  };

  const handleHeaderInfoClick = () => {
    if (isConvoTypeDM && otherMembers && otherMembers.length !== 0) {
      dispatch(
        viewContactDetails({ userId: otherMembers[0].id, userIdHash: otherMembers[0].idHash })
      );
    } else {
      dispatch(viewRoomDetails());
    }
  };

  const handleSavedItemsClick = () => {
    dispatch(openSavedItems());
  };

  const handleOpenSearchPopout = () => {
    dispatch(openSearchPopout());
  };

  const handleStartMeetingClick = () => {
    if (nonGuestMembersCount === 0) {
      dispatch(
        openAlertModal({
          title: t('Limited guest access'),
          body: t('Wickr network users must be present in the group.'),
        })
      );
    } else {
      dispatch(handleStartCall());
    }
  };

  const showJoinMeetingButton = !!activeCall && !selfCallStatus && !isConvoTypeDM;

  const handleJoinMeetingButtonClick = () => {
    dispatch(joinCall({ vgroupId: '', messageId: 'joinActiveConvoMeeting' }));
  };

  let subtitle = '';
  if (isConvoTypeDM) {
    subtitle = t('Conversations.ConvoHeader.ClickHere');
  } else {
    const subtitleTextArray: string[] = [];
    if (externalMemberCount > 0 && !selfMember?.isGuest) {
      subtitleTextArray.push(
        t('Conversations.ConvoHeader.External', { count: externalMemberCount })
      );
    }

    if (botMembersCount > 0) {
      subtitleTextArray.push(t('Conversations.ConvoHeader.Bot', { count: botMembersCount }));
    }

    subtitleTextArray.push(
      t('Conversations.ConvoHeader.Member', {
        count: allMembersCount,
      })
    );

    if (convoDescription) {
      subtitleTextArray.push(convoDescription);
    }

    subtitle = subtitleTextArray.join(' | ');
  }

  const renderConvoButton = () => (
    <Button onClick={handleHeaderInfoClick}>
      <h1 className={styles.title}>
        <TitleIcon />
        <span className={styles.titleText}>
          {renderConvoTitle()}
          {isConvoTypeDM &&
            otherMembers[0]?.verificationStatus ===
              ContactBackup.Contact.VerificationStatus.VERIFIED && (
              <VerifiedIcon className={styles.verifiedIcon} size={14} />
            )}
        </span>
        {isMLSConvo && <Badge value={raw('MLS')} className={styles.mlsBadge} />}
      </h1>
      <h2 className={styles.subtitle}>
        <span className={styles.subtitleText}>{subtitle}</span>
        <CaretIcon direction="right" />
      </h2>
    </Button>
  );

  const tourRef = useSetCoachMarkTarget('tutorial-tour', 'search');

  return (
    <header
      className={clsx(styles.chatHeader, {
        [styles.tabs]: shouldShowFileManagement,
      })}
    >
      <KeyboardShortcut shortcut="ViewConversation" onShortcut={handleHeaderInfoClick} />
      <KeyboardShortcut shortcut="ShowPinnedItems" onShortcut={handleSavedItemsClick} />
      <div className={styles.topRow}>
        <div className={styles.headerInfo}>
          {!isProd && isMLSConvo ? (
            <PopOver
              triggerType="contextmenu"
              iconGutter
              popoverContent={() => (
                <>
                  <PopOverItem
                    icon={<RetryIcon />}
                    onClick={() => dispatch(mlsAction({ action: 'mlsChatResync', vgroupId }))}
                  >
                    MLS Chat Resync
                  </PopOverItem>
                  <PopOverItem
                    icon={<RetryIcon />}
                    onClick={() => dispatch(mlsAction({ action: 'mlsPrivateChatRecreate' }))}
                  >
                    MLS Private Chat Recreate
                  </PopOverItem>
                  <PopOverItem
                    icon={<DeleteIcon />}
                    variant="alert"
                    onClick={() => dispatch(mlsAction({ action: 'mlsDeleteLocalChat', vgroupId }))}
                  >
                    MLS Delete Local Chat
                  </PopOverItem>
                </>
              )}
            >
              {renderConvoButton()}
            </PopOver>
          ) : (
            renderConvoButton()
          )}
          {tdfEnabled && shortenedTdfTags.length > 0 && (
            <div className={styles.tdfTagsWrapper}>
              {shortenedTdfTags.map((tag) => (
                <Tag key={tag} name={tag} />
              ))}
            </div>
          )}
        </div>
        {showSecurityTag && (
          <div className={styles.securityTagWrapper}>
            <div className={styles.securityTag} style={{ backgroundColor: securityTagColor || '' }}>
              <TagIcon filled />
              <div className={styles.securityTagName}>{securityTagName}</div>
            </div>
          </div>
        )}
        <div className={styles.headerActionButtons}>
          <IconButton
            onClick={handleHeaderInfoClick}
            label={t('Conversations.ConvoHeader.RoomDetails')}
          >
            <InformationIcon size="20px" />
          </IconButton>
          {!isConvoTypeDM && (
            <IconButton
              onClick={handleSavedItemsClick}
              label={t(
                isFileManagementEnabled
                  ? 'Conversations.ConvoHeader.SavedLinks'
                  : 'Conversations.ConvoHeader.SavedItems'
              )}
            >
              {isFileManagementEnabled ? (
                <LinkIcon size="20px" />
              ) : (
                <FolderIcon filled size="20px" />
              )}
            </IconButton>
          )}
          <IconButton
            onClick={handleOpenSearchPopout}
            label={t('Conversations.ConvoHeader.GlobalSearch')}
            ref={tourRef}
          >
            <SearchStarIcon filled size="20px" />
          </IconButton>
          {canStartCall && (
            <KeyboardShortcut
              shortcut="StartCall"
              onShortcut={handleStartMeetingClick}
              disabled={hasUnauthorizedMembers}
            />
          )}
          {canStartCall && !hasUnauthorizedMembers && (
            <IconButton
              onClick={handleStartMeetingClick}
              label={t('Conversations.ConvoHeader.StartMeeting')}
              selected={!!activeCall}
              aria-disabled={isCallShuttingDown}
            >
              <PhoneIcon size="20px" />
            </IconButton>
          )}
          {showJoinMeetingButton && !hasUnauthorizedMembers && (
            <Button onClick={handleJoinMeetingButtonClick} shape="rounded" color="green">
              {t('Conversations.ConvoHeader.JoinMeeting')}
            </Button>
          )}
        </div>
      </div>
      {shouldShowFileManagement && (
        <div className={styles.headerTabs}>
          <Tabs selectedLabel={t('selected')} onSelectTab={onSelectTab} activeTab={selectedTab}>
            <Tab
              index={convoHeaderTabMap.messages}
              ariaLabel={t('Conversations.ConvoHeader.Messages')}
            >
              {t('Conversations.ConvoHeader.Messages')}
            </Tab>
            <Tab index={convoHeaderTabMap.files} ariaLabel={t('Conversations.ConvoHeader.Files')}>
              {t('Conversations.ConvoHeader.Files')}
            </Tab>
            {activeConvoWebAppLoaded && isBeta && (
              <Tab index={convoHeaderTabMap.webApp} ariaLabel={'App'}>
                App
              </Tab>
            )}
          </Tabs>
        </div>
      )}
    </header>
  );
};

const ConvoHeader = withErrorBoundary(ConvoHeaderImpl, 'ConvoHeader', {
  displayName: 'ConvoHeader',
  Fallback: ({ error }) => {
    const { t } = useAppTranslation();
    const isProd = useSetting('isProduction');

    return (
      <header className={styles.chatHeader}>
        <div className={styles.topRow}>
          <div className={styles.headerInfo}>
            <div style={{ padding: '16px' }}>
              <h1 className={styles.title}>
                <span className={styles.titleText}>{t('Error')}</span>
              </h1>
              <h2 className={styles.subtitle}>
                {isProd ? (
                  <span className={styles.subtitleText}>{error.message}</span>
                ) : (
                  <details>
                    <summary style={{ cursor: 'pointer' }}>{error.message}</summary>
                    <pre>{error.stack}</pre>
                  </details>
                )}
              </h2>
            </div>
          </div>
        </div>
      </header>
    );
  },
});

export default ConvoHeader;
