import { useEffect, useState } from 'react';
import { useCachedMessage } from '@/lib/cache/useCachedMessage';
import { useAppTranslation } from '@/lib/i18n';
import { useAppDispatch, useAppSelector } from '@/store';
import { selectActiveConvoId } from '@/store/slices/shared';
import { setHighlightedMsgId } from '@/store/slices/uiChat';
import { fetchAndUpsertMessage, switchActiveConvoAndMessage } from '@/store/thunks/messages';
import { MessagePreview } from '.';

import styles from './styles.module.less';

interface MessageQuoteProps {
  msgId: string;
}

export const MessageQuote: React.FC<MessageQuoteProps> = ({ msgId }) => {
  const { t } = useAppTranslation();
  const dispatch = useAppDispatch();
  const activeConvoId = useAppSelector(selectActiveConvoId);
  const message = useCachedMessage(activeConvoId, msgId);
  const [isLoading, setIsLoading] = useState<boolean>(!message);

  useEffect(() => {
    if (message) {
      setIsLoading(false);
      return;
    }

    let mounted = true;
    // notes:
    // 1. unless the quoted message is loaded in view already, the fetched message will be stored in cache only
    // 2. calling fetchMessage twice wouldn't create two api requests, since the message will be cached
    dispatch(
      fetchAndUpsertMessage({ vGroupID: activeConvoId, msgId: msgId, reason: 'getQuotedMessage' })
    ).then(() => {
      if (!mounted) return;
      setIsLoading(false);
    });

    return () => {
      mounted = false;
    };
  }, [message]);

  const handleClick = () => {
    if (!message) return;
    dispatch(
      switchActiveConvoAndMessage({
        scrollToMsgId: msgId,
      })
    );
    dispatch(setHighlightedMsgId(msgId));
  };

  return (
    <MessagePreview
      type="reply"
      isLoading={isLoading}
      className={styles.quote}
      onClick={handleClick}
      message={message}
    />
  );
};
