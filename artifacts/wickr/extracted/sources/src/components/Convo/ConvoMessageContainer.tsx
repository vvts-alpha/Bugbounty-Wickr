import { isSameDay } from 'date-fns';
import React, { HTMLAttributes, useEffect, useLayoutEffect, useRef } from 'react';
import { useControlMessage } from '@/hooks/useControlMessage';
import useLatestCallback from '@/hooks/useLatestCallback';
import { useAppTranslation } from '@/lib/i18n';
import { isControlMessage, WickrMessage } from '@/lib/protobuf/messages';
import { formatRelativeDate } from '@/utils/date';
import { useActiveMessageId } from './ArrowKeyNavigationProvider';
import ConvoAutoSummaryMessage from './ConvoAutoSummaryMessage';
import ConvoControlMessage from './ConvoControlMessage';
import ConvoMessage from './ConvoMessage';

import MessageSeparator from './MessageSeparator';
import styles from './Convo.module.less';

interface ConvoMessageContainerProps extends HTMLAttributes<HTMLElement> {
  id: string;
  message: WickrMessage;
  prevMessage: WickrMessage | undefined;
  showUnreadSeparator?: boolean;
  isLastMessage: boolean;
  /** This event is fired when the component unmounts while being focused */
  onUnmountBlur: () => void;
}

const ConvoMessageContainer: React.FC<ConvoMessageContainerProps> = React.memo(
  ({ id, message, prevMessage, showUnreadSeparator, isLastMessage, onUnmountBlur }) => {
    const activeMessageId = useActiveMessageId();
    const { t } = useAppTranslation();
    const { text } = useControlMessage(message.vGroupID, message.msgId);

    let showDateSeparator = false;
    const { timeStamp } = message;
    const prevTimeStamp = prevMessage?.timeStamp ?? 0;

    let dateLabel = '';
    if (!isSameDay(timeStamp, prevTimeStamp) && (!isControlMessage(message) || text)) {
      showDateSeparator = true;
      dateLabel = formatRelativeDate(timeStamp, t);
    }

    const isConsecutiveMessage =
      message.senderHash === prevMessage?.senderHash && !isControlMessage(prevMessage);

    const ref = useRef<HTMLDivElement>(null);

    const tabIndex = activeMessageId === message.msgId ? 0 : undefined;

    useEffect(() => {
      if (tabIndex === 0) {
        ref.current?.focus();
        // Manually scroll to center to trigger to top fetch listener
        ref.current?.scrollIntoView({ block: 'center' });
      }
    }, [tabIndex]);

    const latestOnUnmountBlur = useLatestCallback(onUnmountBlur);

    useLayoutEffect(() => {
      return () => {
        // if current component has focus
        // notify parent component
        if (ref.current?.contains(document.activeElement)) {
          latestOnUnmountBlur();
        }
      };
    }, [latestOnUnmountBlur]);

    return (
      <div tabIndex={tabIndex} ref={ref} className={styles.messageRoot}>
        <MessageSeparator
          showUnreadSeparator={showUnreadSeparator}
          showDateSeparator={showDateSeparator}
          dateLabel={dateLabel}
        />
        {message.isAutoSummaryMessage ? (
          <ConvoAutoSummaryMessage key={id} id={id} message={message} />
        ) : isControlMessage(message) ? (
          <ConvoControlMessage key={id} id={id} message={message} />
        ) : (
          <>
            <ConvoMessage
              key={id}
              id={id}
              isLastMessage={!message.text?.tableMeta && isLastMessage}
              showSenderName={!isConsecutiveMessage || showDateSeparator}
              showAvatar={!isConsecutiveMessage || showDateSeparator}
            />

            {message.text?.tableMeta && (
              // Message with table content
              <ConvoMessage
                key={message.text.tableMeta.name + id}
                id={message.text.tableMeta.name + id}
                isTableMessage
                isLastMessage={isLastMessage}
                showSenderName={false}
                showAvatar={false}
              />
            )}
          </>
        )}
      </div>
    );
  }
);

if (__DEV__) ConvoMessageContainer.displayName = 'ConvoMessageContainer';

export default ConvoMessageContainer;
