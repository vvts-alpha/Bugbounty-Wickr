import { FC } from 'react';
import { useAppTranslation } from '@/lib/i18n';

import styles from './Convo.module.less';

interface SeparatorProps {
  showUnreadSeparator?: boolean;
  showDateSeparator?: boolean;
  dateLabel?: string;
}

const MessageSeparator: FC<SeparatorProps> = ({
  showUnreadSeparator,
  showDateSeparator,
  dateLabel,
}) => {
  const { t } = useAppTranslation();

  if (!showUnreadSeparator && !showDateSeparator) {
    return null;
  }

  return (
    <div className={styles.separator}>
      {showUnreadSeparator && (
        <>
          <div />
          <span className={styles.unreadMessagesLabel}>{t('Conversations.UnreadMessages')}</span>
          {!showDateSeparator && <div />}
        </>
      )}
      {showDateSeparator && (
        <>
          <div />
          <span className={styles.dateLabel}>{dateLabel}</span>
        </>
      )}
    </div>
  );
};

export default MessageSeparator;
