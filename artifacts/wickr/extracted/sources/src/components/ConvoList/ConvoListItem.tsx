import { clsx } from 'clsx';
import { isToday, isYesterday, millisecondsToSeconds } from 'date-fns';
import { FC, memo, useState } from 'react';
import { Avatar } from '../Avatar';
import CrossBoundaryClassificationTag from '../Convo/CrossBoundaryClassificationTag';
import { getMuteDurationSecondsByLabel } from '../Panels/NotificationsPanel/utils';
import { UpdateNotificationPreferencesPayload } from '@/apis/webChannel/BridgeWebChannel';
import { generateChatRoute } from '@/chat/routes';
import {
  AvatarGroupIcon,
  AvatarPairIcon,
  Badge,
  FlaskIcon,
  GridGlobeIcon,
  IconButton,
  InactiveIcon,
  MoreIcon,
  NavCell,
  PopOver,
  PopOverItem,
  PopOverSeparator,
  Tooltip,
  LeaveIcon,
  PinIcon,
  UnpinIcon,
  NotificationsIcon,
} from '@/componentlibrary';
import PopOverSubmenu from '@/componentlibrary/PopOver/PopOverSubmenu';
import { useOnResized } from '@/hooks/resizeObserver';
import { useAppTranslation } from '@/lib/i18n';
import { metrics } from '@/lib/metrics';
import { MuteNotificationsAttributes } from '@/lib/metrics/models';
import { WickrConvoType } from '@/lib/protobuf/convos';
import { useAppDispatch, useAppSelector, useAppSelectorExtra } from '@/store';
import { useFeature } from '@/store/hooks/useFeature';
import { useSetting } from '@/store/hooks/useSetting';
import {
  CONVO_MUTE_OPTIONS,
  ConvoEntity,
  ConvoMuteOptions,
  selectConvoCanDeleteConvo,
  selectConvoCanLeaveConvo,
  selectConvoIsMuted,
  selectConvoSilenced,
  selectConvoSyncedNotificationPreferences,
  selectConvoType,
} from '@/store/slices/convos';
import { selectSelfUserIsGuest } from '@/store/slices/identity';
import { pushModal } from '@/store/slices/modal';
import {
  pinConvo,
  unpinConvo,
  updateConvoNotificationPreferences,
  markConvoAsUnread,
} from '@/store/thunks/convos';
import { getHourCycle, skewNow } from '@/utils/date';
import { asHtmlElement } from '@/utils/dom';
import { raw } from '@/utils/strings';
import Badges from './Badges';
import typingIndicatorDark5 from './typingIndicator/dark_5fps.webp';
import typingIndicatorLight5 from './typingIndicator/light_5fps.webp';

import styles from './styles.module.less';

type ConvoListItemProps = {
  convo: ConvoEntity;
  onConvoClick: (vgroupId: string) => void;
};

const ConvoListItem: FC<ConvoListItemProps> = ({ convo, onConvoClick }) => {
  const { t } = useAppTranslation();
  const dispatch = useAppDispatch();
  const {
    title,
    vGroupID,
    sortTimestamp = 0,
    unreadCount,
    activeCall = false,
    type,
    isModerator,
    moderatorCount,
    pinned,
    containsExternal,
    dmUserHash,
    groupMemberCount,
    typing,
    mentionCount,
    unacknowledgedSendErrorCount,
    inactive,
    resendInProgress,
    isMLS,
    markedAsUnread = false,
  } = convo;
  const handleConvoClick = () => {
    if (markedAsUnread) {
      dispatch(
        markConvoAsUnread({ vgroupId: vGroupID, markAsUnread: false, action: 'enterConvo' })
      );
    }
    onConvoClick(vGroupID);
  };
  const convosCombinedSetting = useSetting('convosCombined');
  const convoType = useAppSelectorExtra(selectConvoType, vGroupID);
  const isDM = convoType === WickrConvoType.DM;
  const isGuest = useAppSelector(selectSelfUserIsGuest);
  const isTypingIndicatorEnabled = useSetting('isTypingIndicatorEnabled');
  const showMLSBadge = isMLS;
  const theme = useSetting('theme');
  const use12HourFormat = useSetting('use12HourFormat');
  const hourCycle = getHourCycle(use12HourFormat);
  const notificationsEnabled = useSetting('enableNotifications');
  const onlyShow1To1Notifications = useSetting('onlyShow1To1Notifications');
  const isMuted = useAppSelectorExtra(selectConvoIsMuted, vGroupID);
  const isSynced = useAppSelectorExtra(selectConvoSyncedNotificationPreferences, vGroupID);
  const canDeleteConvo = useAppSelectorExtra(selectConvoCanDeleteConvo, vGroupID);
  const canLeaveConvo = useAppSelectorExtra(selectConvoCanLeaveConvo, vGroupID);
  const canMarkConvoAsUnread = useFeature('MarkConvoAsUnread');
  const silenceConversationsEnabled = useFeature('SilenceConversations');
  const isSilenced =
    useAppSelectorExtra(selectConvoSilenced, vGroupID) && silenceConversationsEnabled;

  const getConvoTitle = () => {
    let convoTitle = title ?? '';

    if (type === WickrConvoType.Group && convo.groupMemberCount === 1) {
      convoTitle = t('All members have left');
    }

    return convoTitle;
  };

  const formatTimestamp = (date: number) => {
    let formattedTimestamp = '';
    if (isToday(date)) {
      formattedTimestamp = t('Intl.DateTime', {
        val: new Date(date),
        formatParams: {
          val: { hour: 'numeric', minute: 'numeric', hourCycle: hourCycle },
        },
      });
    } else if (isYesterday(date)) {
      formattedTimestamp = t('Conversations.Yesterday');
    } else {
      formattedTimestamp = t('Intl.DateTime', {
        val: new Date(date),
        formatParams: {
          val: { year: '2-digit', month: 'numeric', day: 'numeric' },
        },
      });
    }
    return formattedTimestamp;
  };

  const handleUnmute = () => {
    dispatch(
      updateConvoNotificationPreferences({
        vgroupId: vGroupID,
        isMuted: false,
        sync: isSynced,
      })
    );
    metrics.addMetrics('MuteNotificationsStopped', {
      attributes: {
        syncDevices: isSynced,
        convoType,
        eventUiLocation: 'convo-list',
      },
    });
  };

  const renderMenu = () => {
    const shouldShowLeaveButton = () => {
      if (canLeaveConvo) {
        if (type === WickrConvoType.Room) {
          // Cannot leave convo if you are the only moderator
          // TODO: This check may be handled by RBAC in the future
          if (isModerator && (moderatorCount ?? 0) < 2) {
            return false;
          }
        }
      }
      return canLeaveConvo;
    };

    const handleMute = (option: ConvoMuteOptions, silence: boolean = false) => {
      dispatch(
        updateConvoNotificationPreferences({
          vgroupId: vGroupID,
          muteExpiration:
            option === 'Always'
              ? -1
              : millisecondsToSeconds(skewNow()) + getMuteDurationSecondsByLabel(option),
          isMuted: true,
          sync: false,
          silenced: silence,
          ...(!isDM &&
            ({
              muteSelfMentions: false,
              muteAllMentions: false,
            } satisfies Partial<UpdateNotificationPreferencesPayload>)), // Needed for TS check
        })
      );

      metrics.addMetrics('MuteNotificationsStarted', {
        attributes: {
          muteDuration: option,
          syncDevices: false,
          convoType,
          eventUiLocation: 'convo-list',
          ...(!isDM &&
            ({
              allowSelfMentions: false,
              allowAllMentions: false,
            } satisfies Partial<MuteNotificationsAttributes>)),
        },
      });
    };

    const renderMuteOptionsMenu = () =>
      CONVO_MUTE_OPTIONS.map((option) => (
        <PopOverItem key={option} onClick={() => handleMute(option, false)}>
          {option}
        </PopOverItem>
      ));

    const renderSilenceOptionsMenu = () =>
      CONVO_MUTE_OPTIONS.map((option) => (
        <PopOverItem key={option} onClick={() => handleMute(option, true)}>
          {option}
        </PopOverItem>
      ));

    const shouldShowMuteOption = () => {
      if ((convoType !== WickrConvoType.DM && onlyShow1To1Notifications) || isMuted) return false;
      return notificationsEnabled;
    };

    const shouldShowUnmuteOption = () => {
      if ((convoType !== WickrConvoType.DM && onlyShow1To1Notifications) || !isMuted) return false;
      return notificationsEnabled;
    };

    return [
      pinned ? (
        <PopOverItem
          icon={<UnpinIcon />}
          key="unpin"
          onClick={() => dispatch(unpinConvo(vGroupID))}
        >
          {t('Unpin')}
        </PopOverItem>
      ) : (
        <PopOverItem icon={<PinIcon />} key="pin" onClick={() => dispatch(pinConvo(vGroupID))}>
          {t('Pin')}
        </PopOverItem>
      ),
      shouldShowMuteOption() && (
        <PopOverSubmenu
          itemProps={{ icon: <NotificationsIcon muted /> }}
          key="mute"
          popoverContent={renderMuteOptionsMenu}
        >
          {t('Mute Notifications')}
        </PopOverSubmenu>
      ),
      shouldShowUnmuteOption() && (
        <PopOverItem icon={<NotificationsIcon />} key="unmute" onClick={handleUnmute}>
          {t('Unmute')}
        </PopOverItem>
      ),
      silenceConversationsEnabled && shouldShowMuteOption() && (
        <PopOverSubmenu
          itemProps={{ icon: <FlaskIcon /> }}
          key="silence"
          popoverContent={renderSilenceOptionsMenu}
        >
          {raw('Silence conversation')}
        </PopOverSubmenu>
      ),
      canMarkConvoAsUnread &&
        (!markedAsUnread && unreadCount === 0 ? (
          <PopOverItem
            key="markAsUnread"
            onClick={() =>
              dispatch(
                markConvoAsUnread({ vgroupId: vGroupID, markAsUnread: true, action: 'convoList' })
              )
            }
          >
            {raw('Mark as Unread')}
          </PopOverItem>
        ) : (
          <PopOverItem
            key="markAsRead"
            onClick={() =>
              dispatch(
                markConvoAsUnread({ vgroupId: vGroupID, markAsUnread: false, action: 'convoList' })
              )
            }
          >
            {raw('Mark as Read')}
          </PopOverItem>
        )),
      shouldShowLeaveButton() && (
        <PopOverItem
          icon={<LeaveIcon />}
          key="leave"
          onClick={() =>
            dispatch(pushModal({ name: 'LeaveConvoModal', params: { vGroupId: vGroupID } }))
          }
        >
          {t('Leave')}
        </PopOverItem>
      ),
      canDeleteConvo && (
        <>
          <PopOverSeparator />
          <PopOverItem
            key="delete"
            variant="alert"
            onClick={() =>
              dispatch(pushModal({ name: 'DeleteConvoModal', params: { vGroupId: vGroupID } }))
            }
          >
            {t('Delete')}
          </PopOverItem>
        </>
      ),
    ];
  };

  const getConvoIcon = () => {
    if (type === WickrConvoType.DM) {
      return (
        <Avatar
          size={22}
          className={styles.avatarIcon}
          userIdHash={dmUserHash || undefined}
          name={title ?? ''}
        />
      );
    }

    if (containsExternal && !isGuest) {
      return <GridGlobeIcon className={styles.blue} filled size="16px" />;
    }

    if (type === WickrConvoType.Group) {
      return <AvatarPairIcon filled size={'16px'} />;
    }

    return <AvatarGroupIcon filled size={'16px'} />;
  };

  const getConvoIconBadge = () => {
    if (inactive) {
      return (
        <div className={clsx(styles.convoIconBadge, styles.red)}>
          <InactiveIcon size="12px" />
        </div>
      );
    }

    if (containsExternal && type === WickrConvoType.DM && !isGuest) {
      return (
        <div className={styles.convoIconBadge}>
          <GridGlobeIcon className={styles.blue} filled size="12px" />
        </div>
      );
    }
  };

  const getConvoIconTooltip = () => {
    // DMs with an external user
    if (type === WickrConvoType.DM && containsExternal) {
      return (
        <div className={styles.tooltip}>
          <div className={styles.title}>{t('ConvoList.OutOfNetworkUser')}</div>
        </div>
      );
    }

    // Other convo types with external users in them
    if (containsExternal) {
      return (
        <div className={styles.tooltip}>
          <div className={styles.title}>{t('ConvoList.ExternalMember')}</div>
          <div className={styles.description}>
            {type === WickrConvoType.Group
              ? t('ConvoList.ExternalMember.Group.Description')
              : t('ConvoList.ExternalMember.Room.Description')}
          </div>
        </div>
      );
    }

    // Rooms and groups
    if (type === WickrConvoType.Room || type === WickrConvoType.Group) {
      return (
        <div className={styles.tooltip}>
          <div className={styles.title}>
            {type === WickrConvoType.Room ? t('ConvoList.Room') : t('ConvoList.GroupMessage')}
          </div>
          <div className={styles.description}>
            {type === WickrConvoType.Room
              ? t('ConvoList.Room.Description')
              : t('ConvoList.GroupMessage.Description')}
          </div>
        </div>
      );
    }

    // DMs without external members do not get tooltips
  };

  const timestamp = formatTimestamp(sortTimestamp);

  const [titleIsHovered, setTitleIsHovered] = useState(false);
  const [hasEllipsis, setHasEllipsis] = useState(false);
  const titleRef = useOnResized((entry) => {
    const element = asHtmlElement(entry.target);
    if (!element) return;
    setHasEllipsis(element.scrollWidth - element.offsetWidth > 0);
  });

  const [menuIsOpen, setMenuIsOpen] = useState(false);

  const showMutedIcon = () => {
    if (convoType !== WickrConvoType.DM && onlyShow1To1Notifications) return false;
    return notificationsEnabled;
  };

  // VoiceOver cannot read <li> tags in the QT WebEngine
  return (
    <PopOver iconGutter popoverContent={renderMenu} triggerType="contextmenu">
      <div
        className={clsx(styles.linkWrapper, {
          [styles.silenced]: isSilenced,
        })}
      >
        <Tooltip tip={hasEllipsis ? getConvoTitle() : null} delay>
          <span>
            <NavCell
              label={getConvoTitle()}
              linkTo={generateChatRoute.convo(vGroupID, 'messages')}
              className={clsx(styles.cell, { [styles.menuIsOpen]: menuIsOpen })}
              onClick={handleConvoClick}
            >
              {isTypingIndicatorEnabled && typing && !isSilenced ? (
                <img
                  src={theme === 'light-theme' ? typingIndicatorLight5 : typingIndicatorDark5}
                  className={styles.typingIcon}
                />
              ) : (
                <Tooltip tip={getConvoIconTooltip()}>
                  <div className={styles.avatar}>
                    {getConvoIcon()}
                    {getConvoIconBadge()}
                  </div>
                </Tooltip>
              )}
              {convo.crossBoundary && <CrossBoundaryClassificationTag />}
              <div className={styles.titleAndMemberCount}>
                <p
                  className={styles.convoTitle}
                  ref={titleIsHovered ? titleRef : null}
                  onMouseEnter={() => setTitleIsHovered(true)}
                  onMouseLeave={() => setTitleIsHovered(false)}
                >
                  {getConvoTitle()}
                </p>
                {(groupMemberCount ?? 0) > 1 && type === WickrConvoType.Group && (
                  <p className={styles.groupMemberCount}>{groupMemberCount}</p>
                )}
                {(convosCombinedSetting || convo.pinned || !!convo.unreadCount) && convo.isBot && (
                  <Badge value={t('ConvoList.Bot')} className={styles.botBadge} />
                )}
                {showMLSBadge && <span className={styles.mlsBadge}>{raw('MLS')}</span>}
              </div>
              {!!sortTimestamp && <span className={styles.timestamp}>{timestamp}</span>}
              <Badges
                unreadCount={unreadCount}
                mentionCount={mentionCount}
                markedAsUnread={markedAsUnread}
                unacknowledgedSendErrorCount={unacknowledgedSendErrorCount}
                activeCall={activeCall}
                resendInProgress={resendInProgress}
                muted={showMutedIcon() && isMuted}
                silenced={isSilenced}
              />
            </NavCell>
            <PopOver
              iconGutter
              contentWrapperClassName={styles.popoverWrapper}
              popoverContent={renderMenu}
              onOpen={() => setMenuIsOpen(true)}
              onClose={() => setMenuIsOpen(false)}
            >
              <IconButton label={t('MoreOptions')} className={styles.popoverBtn}>
                <MoreIcon height="16px" width="16px" />
              </IconButton>
            </PopOver>
          </span>
        </Tooltip>
      </div>
    </PopOver>
  );
};

export default memo(ConvoListItem);
