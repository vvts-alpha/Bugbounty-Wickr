import { ContactBackup } from '@amzn/wickr-messaging-protocol-proto';
import { clsx } from 'clsx';
import { forwardRef } from 'react';
import { ListItem, VerifiedIcon } from '@/componentlibrary/';
import { Avatar } from '@/components/Avatar';
import { useAppTranslation } from '@/lib/i18n';
import { useAppSelector } from '@/store';
import { useSetting } from '@/store/hooks/useSetting';
import { useUser } from '@/store/hooks/useUsers';
import { selectSelfUser } from '@/store/slices/identity';
import { RoomHistoryItem } from '@/store/slices/roomHistory';
import { formatTimestamp } from '@/utils/date';

import styles from './styles.module.less';

export interface RoomHistoryListItemProps {
  roomHistoryItem: RoomHistoryItem;
  isHighlighted?: boolean;
}

export const RoomHistoryListItem = forwardRef<HTMLDivElement, RoomHistoryListItemProps>(
  ({ roomHistoryItem, isHighlighted }, ref) => {
    const { t } = useAppTranslation();
    const use12HourFormat = useSetting('use12HourFormat');
    const sender = useUser(roomHistoryItem.senderUserHash);
    const isSelfUser = useAppSelector(selectSelfUser)?.id === sender?.id;
    const senderIsVerified =
      sender?.verificationStatus === ContactBackup.Contact.VerificationStatus.VERIFIED &&
      !isSelfUser;

    const timestamp = formatTimestamp(roomHistoryItem?.timestamp, t, use12HourFormat);
    return (
      <div ref={ref}>
        <ListItem
          className={clsx(styles.roomHistoryListItem, {
            [styles.highlight]: isHighlighted,
          })}
        >
          <div className={clsx(styles.avatar, 'notCopyable')}>
            <Avatar
              userIdHash={roomHistoryItem.senderUserHash}
              name={roomHistoryItem.senderDisplayName}
            />
          </div>
          <div className={styles.roomHistoryItemInfo}>
            <div className={styles.senderDisplayName}>
              {roomHistoryItem?.senderDisplayName}
              {senderIsVerified && <VerifiedIcon />}
            </div>
            <div className={styles.msgHeader}>{roomHistoryItem?.msgHeader}</div>
            <div className={styles.msgBody}>{roomHistoryItem?.msgBody}</div>
          </div>
          <div className={styles.timestamp}>{timestamp}</div>
        </ListItem>
      </div>
    );
  }
);

export default RoomHistoryListItem;
