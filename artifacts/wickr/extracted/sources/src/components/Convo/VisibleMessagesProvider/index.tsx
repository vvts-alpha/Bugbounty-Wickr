import { useContext, useEffect, useMemo, useRef } from 'react';
import { useMessageIntersectionCallback } from '../ConvoMessagesObservers/intersectionObserver/MessageIntersectionObserverHooks';
import useConst from '@/hooks/useConst';
import useLatestCallback from '@/hooks/useLatestCallback';
import OrderedLinkedList from '@/lib/cache/OrderedLinkedList';
import { WickrMessage } from '@/lib/protobuf/messages';
import { useAppSelector } from '@/store';
import { selectActiveConvoMessages } from '@/store/slices/convos/convosSelectors';
import { VisibleMessagesChangeEvent, VisibleMessagesContext } from './VisibleMessagesContext';

export const VisibleMessagesProvider: ReactFC = ({ children }) => {
  const listeners = useRef<VisibleMessagesChangeEvent[]>([]);
  const messages = useAppSelector(selectActiveConvoMessages);

  const subscribe = useLatestCallback((newListener: VisibleMessagesChangeEvent) => {
    listeners.current.push(newListener);
    return () => {
      listeners.current = listeners.current.filter((listener) => listener !== newListener);
    };
  });

  const visibleMessagesList = useConst(
    () =>
      new OrderedLinkedList<string, WickrMessage>(
        (a, b) => a.timeStamp - b.timeStamp,
        (m) => m.msgId
      )
  );
  useMessageIntersectionCallback((entriesData) => {
    const newVisibleMessages: WickrMessage[] = [];
    const newHiddenMessages: WickrMessage[] = [];
    // loop through observation data and split them into two categories
    entriesData.forEach(({ entry, data }) => {
      if (!data) return;
      if (entry?.isIntersecting) {
        newVisibleMessages.push(data.message);
      } else {
        // PS: observer will fire callback with entry: undefined when the observed component is no longer mounted
        // component unmount is also considered as hidden
        newHiddenMessages.push(data.message);
      }
    });
    // add all visible messages to list
    visibleMessagesList.upsertMany(newVisibleMessages);
    // remove hidden messages from list
    newHiddenMessages.forEach((message) => {
      visibleMessagesList.delete(message.msgId);
    });
    // find the index of last visible message in active convo messages array
    const oldestVisibleMessage = visibleMessagesList.first;
    const oldestVisibleMessageIndex = messages.findIndex(
      (m) => m.msgId === oldestVisibleMessage?.msgId
    );
    // find the index of first visible message in active convo messages array
    const newestVisibleMessage = visibleMessagesList.last;
    const newestVisibleMessageIndex = messages.findIndex(
      (m) => m.msgId === newestVisibleMessage?.msgId
    );
    const visibleMessages = visibleMessagesList.toArray();
    // fire callback to subscribers
    listeners.current.forEach((listener) =>
      listener({
        visibleMessages,
        newVisibleMessages,
        newHiddenMessages,
        startIndex: oldestVisibleMessageIndex,
        endIndex: newestVisibleMessageIndex,
      })
    );
  });

  const value = useMemo(() => ({ subscribe }), [subscribe]);
  return (
    <VisibleMessagesContext.Provider value={value}>{children}</VisibleMessagesContext.Provider>
  );
};

export const useVisibleMessages = (callback: VisibleMessagesChangeEvent) => {
  const context = useContext(VisibleMessagesContext);

  if (!context) {
    throw new Error('useVisibleMessages must be used within a VisibleMessagesProvider');
  }
  const lastestCallback = useLatestCallback(callback);
  const { subscribe } = context;

  useEffect(() => {
    return subscribe(lastestCallback);
  }, [subscribe]);
};
