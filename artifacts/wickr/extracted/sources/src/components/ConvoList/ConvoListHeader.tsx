import { useAbortableDispatch } from '../../store/hooks/useAbortableDispatch';
import { useSetCoachMarkTarget } from '../CoachMarks/hooks';
import { KeyboardShortcut } from '../KeyboardShortcut';
import {
  Heading,
  IconButton,
  HamburgerIcon,
  EditIcon,
  Tooltip,
  PopOver,
  PopOverItem,
  ChatIcon,
  AvatarGroupIcon,
  AvatarPairIcon,
  PresenceIcon,
  ShieldIcon,
  ScreenReaderContent,
} from '@/componentlibrary';
import { ConvoMembersModalReturnValue } from '@/components/Modals/ConvoMembersModal';
import { useAppTranslation } from '@/lib/i18n';
import { useAppDispatch, useAppSelector } from '@/store';
import { useSelfPresenceIcon } from '@/store/hooks/useSelfPresenceIcon';
import { useSetting } from '@/store/hooks/useSetting';
import { selectIsNavRailEnabled } from '@/store/slices/features';
import {
  selectSelfUser,
  selectSelfUserIdHash,
  selectSelfUserIsGuest,
} from '@/store/slices/identity';
import { pushModal } from '@/store/slices/modal';
import { createDM, fetchUser, createGroup } from '@/store/thunks/messages';
import { openAlertModal, openModal } from '@/store/thunks/modals';
import { openHamburgerMenu } from '@/store/thunks/ui';
import { getContactDisplayName } from '@/utils/strings';

import styles from './styles.module.less';

const ConvoListHeader = () => {
  const dispatch = useAppDispatch();
  const { t } = useAppTranslation();
  const user = useAppSelector(selectSelfUser);
  const userName = getContactDisplayName(user);
  const isNavRailEnabled = useAppSelector(selectIsNavRailEnabled);
  const shouldShowPresenceIcon = useSelfPresenceIcon();
  const selfIdHash = useAppSelector(selectSelfUserIdHash);
  const abortableDispatch = useAbortableDispatch();
  const isGuest = useAppSelector(selectSelfUserIsGuest);
  const isComplianceConfigValid = useSetting('isComplianceConfigValid');

  const handleHamburgerClick = () => {
    dispatch(openHamburgerMenu());
  };

  const handleCreateDM = async () => {
    try {
      const convoMembersModelResult = (await abortableDispatch(
        openModal({
          name: 'ConvoMembersModal',
          params: {
            title: t('Direct Message'),
            multiselect: false,
          },
        })
      )) as ConvoMembersModalReturnValue;
      if (!Array.isArray(convoMembersModelResult.members)) return;
      const [userHash] = convoMembersModelResult.members;
      if (!userHash) return;
      const user = await dispatch(fetchUser(userHash)).unwrap();
      if (user) {
        dispatch(createDM({ message: ' ', userHash, userId: user.id }));
      }
    } catch {
      // no-op
    }
  };

  const handleCreateRoom = () => dispatch(pushModal('NewRoomModal'));

  const tourRef = useSetCoachMarkTarget('tutorial-tour', 'new-message');

  return (
    <div className={styles.header}>
      {isNavRailEnabled ? (
        <div className={styles.menuIconPlaceholder} />
      ) : (
        <IconButton onClick={handleHamburgerClick} label={t('ConvoList.Header.OpenMenu')}>
          <HamburgerIcon width="24px" height="24px" />
        </IconButton>
      )}
      <div className={styles.titleWrapper}>
        <Heading level={3} as="h1" className={styles.usernameWrapper}>
          <span className={styles.username}>{userName}</span>{' '}
          {shouldShowPresenceIcon && <PresenceIcon timeIdle={0} />}
        </Heading>
        <div className={styles.subtitle}>
          {isComplianceConfigValid && (
            <Tooltip tip={t('Data Retention Network')}>
              <span className={styles.shieldWrapper}>
                <ShieldIcon aria-hidden size={12} className={styles.shield} />
                <ScreenReaderContent>{t('Data Retention Network')}</ScreenReaderContent>
              </span>
            </Tooltip>
          )}
          {user?.networkName}
        </div>
      </div>
      <Tooltip tip={t('ConvoList.Header.NewMessage')}>
        {user?.isGuest ? (
          <IconButton
            label={t('ConvoList.Header.NewMessage')}
            onClick={() => {
              dispatch(pushModal('LimitedGuestAccessModal'));
            }}
          >
            <EditIcon width="24px" height="24px" />
          </IconButton>
        ) : (
          <div>
            <PopOver
              popoverContent={() => [
                <NewMessagePopOverItem
                  icon={<ChatIcon />}
                  onClick={handleCreateDM}
                  title={t('ConvoList.Header.NewDirectMessage.Title')}
                  subtitle={t('ConvoList.Header.NewDirectMessage.Subtitle')}
                  key="DirectMessage"
                />,
                <NewMessagePopOverItem
                  icon={<AvatarPairIcon />}
                  onClick={async () => {
                    try {
                      const convoMembersModelResult = (await abortableDispatch(
                        openModal({
                          name: 'ConvoMembersModal',
                          params: {
                            title: t('New Group'),
                            multiselect: true,
                            submitButtonLabel: t('Create'),
                          },
                        })
                      )) as ConvoMembersModalReturnValue | undefined;
                      const members = convoMembersModelResult?.members;
                      if (convoMembersModelResult && Array.isArray(members) && members.length > 1) {
                        const membersArr: string[] = members;
                        const membersWithoutSelf = membersArr.filter((m) => m !== selfIdHash);
                        dispatch(
                          createGroup({
                            members: membersWithoutSelf,
                          })
                        );
                      } else if (convoMembersModelResult !== undefined) {
                        dispatch(
                          openAlertModal({
                            title: t('Notice'),
                            body: t('Error creating conversation'),
                          })
                        );
                      }
                    } catch {
                      // no-op
                    }
                  }}
                  title={t('ConvoList.Header.NewGroupMessage.Title')}
                  subtitle={t('ConvoList.Header.NewGroupMessage.Subtitle')}
                  key="GroupMessage"
                />,
                <NewMessagePopOverItem
                  icon={<AvatarGroupIcon />}
                  onClick={handleCreateRoom}
                  title={t('ConvoList.Header.CreateARoom.Title')}
                  subtitle={t('ConvoList.Header.CreateARoom.Subtitle')}
                  key="CreateARoom"
                />,
              ]}
            >
              <IconButton label={t('ConvoList.Header.NewMessage')} ref={tourRef}>
                <EditIcon width="24px" height="24px" />
              </IconButton>
            </PopOver>
          </div>
        )}
      </Tooltip>
      <KeyboardShortcut shortcut="CreateDM" onShortcut={handleCreateDM} disabled={isGuest} />
      <KeyboardShortcut shortcut="CreateRoom" onShortcut={handleCreateRoom} disabled={isGuest} />
    </div>
  );
};

export default ConvoListHeader;

interface NewMessagePopOverItemProps {
  title: string;
  subtitle: string;
  icon: JSX.Element;
  onClick: () => void;
}

const NewMessagePopOverItem: React.FC<NewMessagePopOverItemProps> = ({
  title,
  subtitle,
  icon,
  onClick,
}) => {
  return (
    <PopOverItem contentClassName={styles.headerPopOverItem} onClick={onClick}>
      <span className={styles.iconWrapper}>{icon}</span>
      <span className={styles.text}>
        <span className={styles.title}>{title}</span>
        <span className={styles.subtitle}>{subtitle}</span>
      </span>
    </PopOverItem>
  );
};
