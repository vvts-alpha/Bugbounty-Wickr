import { RefObject, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ScrollEventType } from '../ConvoMessagesContainer';

import { VirtualListMethods } from '@/componentlibrary/VirtualList/VirtualListContainer';
import {
  AnchorType,
  SingleVirtualListScrollTo,
  VirtualListScrollToLocation,
} from '@/componentlibrary/VirtualList/types';
import useChangeEffect from '@/hooks/useChangeEffect';
import useForceUpdate from '@/hooks/useForceUpdate';
import useLatestCallback from '@/hooks/useLatestCallback';
import { Logger } from '@/lib/logger';
import { metricEvents } from '@/lib/metrics';
import { useAppDispatch, useAppSelector } from '@/store';
import {
  selectActiveConvoBor,
  selectActiveConvoLastMessagesUpdateReason,
  selectActiveConvoMessages,
  selectActiveConvoNewestMsgId,
  selectActiveConvoNewestUnackErrorId,
  selectActiveConvoOldestUnreadMentionId,
} from '@/store/slices/convos';
import { selectIsOSSleep } from '@/store/slices/os';
import { clearScrollToMsgId, selectScrollToMsgId } from '@/store/slices/uiChat';
import { selectChatWindowHasFocus } from '@/store/slices/windows';

const logger = new Logger('useScrollTo');
/**
 * A hook to manage scrolling behaviors within convo messages container, based on different conditions and triggers,
 * it manages scrolling to specific message or a location, based on new messages arrival,
 * changes in scrollToMsgId, or external events such as container resizing
 *
 * @returns A boolean "state" indicating if the chat is scrolled to the bottom
 *
 */
export function useScrollTo(
  virtualListRef: RefObject<VirtualListMethods>,
  isAddingMoreMessages: boolean,
  oldestUnreadMsgId: string | undefined,
  willLoadFutureMessages: boolean
) {
  const dispatch = useAppDispatch();
  const messages = useAppSelector(selectActiveConvoMessages);
  const lastMessagesUpdateReason = useAppSelector(selectActiveConvoLastMessagesUpdateReason);
  const chatWindowFocused = useAppSelector(selectChatWindowHasFocus);
  const convoHasBurnOnRead = !!useAppSelector(selectActiveConvoBor);
  // we can scroll to bottom if focused or no burn on read
  const allowScrollToBottom = chatWindowFocused || !convoHasBurnOnRead;
  const scrollToMsgId = useAppSelector(selectScrollToMsgId);
  const convoNewestMsgId = useAppSelector(selectActiveConvoNewestMsgId);
  const convoOldestUnreadMentionId = useAppSelector(selectActiveConvoOldestUnreadMentionId);
  const convoNewestUnackErrorId = useAppSelector(selectActiveConvoNewestUnackErrorId);
  const isOSSleep = useAppSelector(selectIsOSSleep);
  const forceUpdate = useForceUpdate();
  const isScrolledToBottomRef = useRef(false);
  const [scrollTo, setScrollTo] = useState<SingleVirtualListScrollTo>();

  useEffect(() => {
    // Reset scrollTo whenever it changes to allow scrolling to the same location multiple times in a row
    if (scrollTo) setScrollTo(undefined);
  }, [scrollTo]);

  const scrollToContainerBottom = useLatestCallback(() => {
    setScrollTo(VirtualListScrollToLocation.Bottom);
    // clear primary anchor when scrolling to bottom is prioritized
    logger.info('scrollToContainerBottom', 'clear primary scroll anchor');
    virtualListRef.current?.setScrollAnchor(undefined);
    dispatch(clearScrollToMsgId());
  });

  /**
   * This layout effect handles one thing
   *   1. Scroll to a place on entering a convo (initial rendering)
   *     i. if scrollToMsgId is set, scroll to it
   *     ii. otherwise, scroll to unread or bottom
   */
  useLayoutEffect(() => {
    logger.info('useLayoutEffect(Messages)', 'isAddingMoreMessages', isAddingMoreMessages);
    if (!isAddingMoreMessages) return;
    if (lastMessagesUpdateReason === 'initialRendering') {
      logger.info('useLayoutEffect(Messages)', 'scrollToMsgId', scrollToMsgId);
      if (scrollToMsgId) {
        // when scrollToMsgId is set, scroll to the target message
        scrollToRenderedMessage(scrollToMsgId);
        // clear scrollToMsgId whether the scroll succeeds or not
        clearScrollToMsgId();
        logger.info('useLayoutEffect(Messages)', 'clearScrollToMsgId');
      } else {
        // when scrollToMsgId is not set, use default scroll behavior
        if (oldestUnreadMsgId) {
          logger.info(
            'useLayoutEffect(Messages)',
            'enter convo, scroll to unread',
            oldestUnreadMsgId
          );
          scrollToRenderedMessage(oldestUnreadMsgId, false);
        } else {
          logger.info('useLayoutEffect(Messages)', 'enter convo, scroll to bottom');
          scrollToContainerBottom();
        }
      }
    } else if (
      lastMessagesUpdateReason === 'newMessage' &&
      isScrolledToBottomRef.current &&
      willLoadFutureMessages
    ) {
      // prioritize bottom anchor by removing primary anchor if user is already at the bottom
      logger.info('useLayoutEffect(Messages)', 'newMessage, clear primary anchor');
      virtualListRef.current?.setScrollAnchor(undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages]);

  /**
   * This change effect does one thing, try to scroll to a message whenever scrollToMsgId changes
   * It doesn't care if target message is loaded or not, switchActiveConvoAndMessage will take care of it
   */
  useChangeEffect(() => {
    if (!scrollToMsgId || !messages.length) return;
    logger.info('useChangeEffect(scrollToMessageId)', scrollToMsgId);

    if (messages.find((message) => message.msgId === scrollToMsgId)) {
      // if target message is loaded
      if (scrollToRenderedMessage(scrollToMsgId)) {
        logger.info('useChangeEffect(scrollToMessageId)', 'scrollToMessage success');
      }
      dispatch(clearScrollToMsgId());
    }
  }, [scrollToMsgId]);

  const setPrimaryScrollAnchor = () => {
    if (isScrolledToBottomRef.current && allowScrollToBottom) {
      // if we are already at the bottom and is focused, set primary anchor to bottom element
      logger.info('setPrimaryScrollAnchor', 'set secondary anchor to bottom element');
      virtualListRef.current?.setScrollAnchor(
        VirtualListScrollToLocation.Bottom,
        AnchorType.Secondary
      );
    } else {
      // otherwise, set it to undefined so secondary anchor will be used
      logger.info('setPrimaryScrollAnchor', 'set secondary anchor to undefined');
      virtualListRef.current?.setScrollAnchor(undefined, AnchorType.Secondary);
    }
  };

  useChangeEffect(() => {
    if (!isOSSleep) {
      logger.info('os waking up', 'clear secondary scroll anchor');
      // clear primary scroll anchor on OS sleep, so we don't scroll to bottom automatically
      virtualListRef.current?.setScrollAnchor(undefined, AnchorType.Secondary);
    }
  }, [isOSSleep]);

  const handleScrollPositionStateChange = useLatestCallback(
    (states: { atTop: boolean; atBottom: boolean }) => {
      if (isScrolledToBottomRef.current !== states.atBottom) {
        logger.info('handleScrollPositionStateChange', states);
        isScrolledToBottomRef.current = states.atBottom;
        setPrimaryScrollAnchor();
        forceUpdate();
      }
    }
  );

  useEffect(() => setPrimaryScrollAnchor, [setPrimaryScrollAnchor, allowScrollToBottom]);

  const emitScrollToEndMetric = (msgId: string) => {
    let scrollType: ScrollEventType = 'ScrollToBottom';
    switch (msgId) {
      case convoOldestUnreadMentionId:
        scrollType = 'ScrollToMention';
        break;
      case convoNewestUnackErrorId:
        scrollType = 'ScrollToError';
        break;
    }
    return metricEvents.emit('ScrollEventEnd', { scrollType });
  };

  const scrollToRenderedMessage = (
    msgId: string | undefined,
    scrollToBottomOnNewest = true
  ): boolean => {
    if (!msgId || !messages.find((message) => message.msgId === msgId)) {
      return false;
    }

    // const element = document.getElementById(chatBubbleContainerDOMId(msgId));
    if (convoNewestMsgId === msgId && scrollToBottomOnNewest) {
      logger.info('scrollToRenderedMessage', 'scroll to bottom');
      scrollToContainerBottom();
    } else {
      setScrollTo({ itemKey: msgId, offset: -100 });
    }
    emitScrollToEndMetric(msgId);
    return true;
  };

  // We call force update everytime the ref get changed, so it should be up to date for components use it as a state
  // unless they want to access it in "realtime", which is not a very common use case.
  // We can also return it as is, based on use case, this is subject to change
  return [isScrolledToBottomRef.current, scrollTo, handleScrollPositionStateChange] as const;
}
