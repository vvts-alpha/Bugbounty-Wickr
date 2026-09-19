import React from 'react';

import {
  AvatarPairIcon,
  Badge,
  IconButton,
  InformationIcon,
  LockIcon,
  MessageIcon,
} from '@/componentlibrary';
import { HandRaiseIcon } from '@/componentlibrary/icons';
import styles from './styles.module.less';

export interface SidebarProps {
  isMeetingLocked?: boolean;
  toggled: boolean;
  toggle: (t: boolean) => void;
  meetingQueueList?: any[];
}

const Sidebar: React.FC<SidebarProps> = ({
  isMeetingLocked,
  toggled,
  toggle,
  meetingQueueList,
}) => {
  const unreadCount = 0;
  const presentAttendeesCount = 0;

  const handleToggleSidebarClick = () => {
    toggle(!toggled);
  };

  return (
    <nav className={styles.sidebar}>
      {/* <KeyboardShortcut shortcut={ShortcutName.meetingInfo} onShortcut={handleBridgeInfoClick} /> */}
      <div className={styles.toggleButtonWrapper}>
        <IconButton
          label={'Toggle sidebar'}
          onClick={handleToggleSidebarClick}
          className={styles.toggleButton}
          badge={
            isMeetingLocked ? (
              <Badge aria-hidden value={<LockIcon />} className={styles.badge} />
            ) : null
          }
        >
          <InformationIcon />
        </IconButton>
      </div>

      <div className={styles.toggleButtonWrapper}>
        <IconButton
          label={'Toggle sidebar'}
          onClick={handleToggleSidebarClick}
          className={styles.toggleButton}
          badge={presentAttendeesCount ? <Badge aria-hidden value={presentAttendeesCount} /> : null}
        >
          <AvatarPairIcon />
        </IconButton>
      </div>

      <div className={styles.toggleButtonWrapper}>
        <IconButton
          label={'Toggle sidebar'}
          onClick={handleToggleSidebarClick}
          className={styles.toggleButton}
          badge={unreadCount ? <Badge aria-hidden value={unreadCount} status="alert" /> : null}
          secondaryBadge={
            !toggled && meetingQueueList?.length ? (
              <Badge value={<HandRaiseIcon />} status="alert" />
            ) : null
          }
        >
          <MessageIcon />
        </IconButton>
      </div>
    </nav>
  );
};

export default Sidebar;
