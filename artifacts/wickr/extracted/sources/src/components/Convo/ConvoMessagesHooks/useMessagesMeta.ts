import usePrevious from '@/hooks/usePrevious';
import { useAppSelector } from '@/store';
import {
  selectActiveConvoNewestMsgId,
  selectActiveConvoOldestMsgId,
  selectActiveConvoServerMessages,
} from '@/store/slices/convos';

/**
 * A hook that extracts and computes metadata related to the messages in active convo.
 *
 * @returns An object containing:
 *   - isAddingMoreMessages - indicates if more messages have been added to the convo since the last render
 *   - oldestMsgId - the message id of the oldest message of rendered messages
 *   - oldestUnreadMsgId - the message id of the oldest unread message of rendered messages
 *   - newestMsgId - the message id of the newest unread message of rendered messages
 *   - hasConvoOldestMsg - if the rendered messages has the convo oldest msg based on boundary ids from QT
 *   - hasConvoNewestMsg - if the rendered messages has the convo newest msg based on boundary ids from QT
 */
export function useMessagesMeta() {
  const messages = useAppSelector(selectActiveConvoServerMessages);
  const convoOldestMsgId = useAppSelector(selectActiveConvoOldestMsgId);
  const convoNewestMsgId = useAppSelector(selectActiveConvoNewestMsgId);
  const prevMessagesLength = usePrevious(messages.length);
  const isAddingMoreMessages = messages.length > (prevMessagesLength ?? 0);
  const oldestMsgId = messages[0]?.msgId;
  const oldestUnreadMsgId = messages.find((m) => !m.isRead)?.msgId;
  const newestMsgId = messages[messages.length - 1]?.msgId;
  const hasConvoOldestMsg = !!messages.find((m) => m.msgId === convoOldestMsgId);
  const hasConvoNewestMsg = !!messages.find((m) => m.msgId === convoNewestMsgId);

  return {
    isAddingMoreMessages,
    oldestMsgId,
    oldestUnreadMsgId,
    newestMsgId,
    hasConvoOldestMsg,
    hasConvoNewestMsg,
  };
}
