import { useEffect, useState } from 'react';
import { useMessageCaches } from '@/lib/cache/context';

/** @deprecated  this method is not recommended as we will refactor messages caching in the future, for more context visit: https://code.amazon.com/reviews/CR-107620557/revisions/1#/comments  */
export const useCachedMessage = (vGroupID: string, msgId: string | undefined) => {
  const messageCache = useMessageCaches().getOrCreate(vGroupID);
  const [message, setMessage] = useState(msgId ? messageCache.get(msgId) : undefined);
  useEffect(() => {
    if (!msgId) return;
    setMessage(messageCache.get(msgId));
    const unsubscribe = messageCache.subscribe(msgId, (newMessage) => {
      setMessage(newMessage);
    });
    return () => unsubscribe();
  }, [messageCache, vGroupID, msgId]);

  return message;
};
