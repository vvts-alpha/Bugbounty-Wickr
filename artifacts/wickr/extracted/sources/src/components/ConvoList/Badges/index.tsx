import { clsx } from 'clsx';
import { FC } from 'react';
import { Badge, CautionIcon, NotificationsIcon, PhoneIcon, SpinnerIcon } from '@/componentlibrary';
import { AT_MENTION_PREFIX } from '@/components/ComposeBox/Extensions/Mention/MentionList';
import { HUNDRED_AND_MORE_BADGE_TEXT } from '@/utils/strings';

import styles from './styles.module.less';

interface BadgesProps {
  className?: string;
  mentionCount?: number;
  activeCall?: boolean | null;
  unreadCount?: number;
  markedAsUnread?: boolean | null;
  unacknowledgedSendErrorCount?: number;
  resendInProgress?: boolean;
  muted?: boolean;
  silenced?: boolean;
}

const Badges: FC<BadgesProps> = ({
  className,
  mentionCount = 0,
  activeCall,
  unreadCount,
  markedAsUnread,
  unacknowledgedSendErrorCount,
  resendInProgress,
  muted,
  silenced,
}) => {
  return (
    <div className={clsx(styles.badges, className)}>
      {!silenced && mentionCount > 0 && (
        <Badge value={AT_MENTION_PREFIX} className={styles.mentionBadge} />
      )}
      {activeCall && (
        <Badge
          value={<PhoneIcon filled height="8px" width="8px" />}
          status="success"
          className={styles.callBadge}
        />
      )}
      {!silenced && (!!unreadCount || markedAsUnread) && (
        <Badge
          value={(unreadCount ?? 0) > 99 ? HUNDRED_AND_MORE_BADGE_TEXT : unreadCount || '•'}
          className={styles.unreadCountBadge}
        />
      )}
      {!!unacknowledgedSendErrorCount && (
        <Badge
          value={<CautionIcon filled height="9px" width="9px" />}
          className={clsx(styles.iconBadge, styles.unackedSendErrorBadge)}
        />
      )}
      {muted && (
        <Badge
          value={<NotificationsIcon muted height="18px" width="18px" />}
          className={styles.mutedBadge}
        />
      )}
      {!!resendInProgress && <SpinnerIcon />}
    </div>
  );
};

export default Badges;
