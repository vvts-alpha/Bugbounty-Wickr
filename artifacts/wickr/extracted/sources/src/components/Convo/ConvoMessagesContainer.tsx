import { useState, useRef, useEffect, SyntheticEvent, useMemo } from 'react';
import MoreUnreadFAB from '../MoreUnreadFAB';
import DelayRender from '@/componentlibrary/DelayRender';
import { VirtualList } from '@/componentlibrary/VirtualList/VirtualList';
import { VirtualListMethods } from '@/componentlibrary/VirtualList/VirtualListContainer';
import { SingleVirtualListScrollTo } from '@/componentlibrary/VirtualList/types';
import { useAutoSummary } from '@/hooks/useAutoSummary';
import useExtraLoggingAfterWakeUp from '@/hooks/useExtraLoggingAfterWakeUp';
import useForceUpdate from '@/hooks/useForceUpdate';
import useLatestCallback from '@/hooks/useLatestCallback';
import useMergeRefs from '@/hooks/useMergeRefs';
import usePrevious from '@/hooks/usePrevious';
import { Logger } from '@/lib/logger';
import { metricEvents } from '@/lib/metrics';
import { WickrMessage } from '@/lib/protobuf/messages';
import { useAppDispatch, useAppSelector } from '@/store/';
import {
  selectActiveConvoOldestMsgId,
  selectActiveConvoNewestMsgId,
  selectActiveConvoMessages,
  selectActiveConvoUnreadMessagesCount,
  selectActiveConvoUnreadMentionMessagesCount,
  selectActiveConvoOldestUnreadMentionId,
  selectActiveConvoOldestUnreadMsgId,
  selectActiveConvoUnacknowledgedSendErrorCount,
  selectActiveConvoNewestUnackErrorId,
  selectActiveConvoLastMessagesUpdateReason,
} from '@/store/slices/convos';
import { selectActiveConvoId } from '@/store/slices/shared';
import { selectChatWindowHasFocus } from '@/store/slices/windows';
import {
  FETCH_NEWER_MESSAGES_INCREMENTAL,
  FETCH_OLDER_MESSAGES_INCREMENTAL,
  PREFETCH_NEWER_MESSAGES_OFFSET,
  PREFETCH_OLDER_MESSAGES_OFFSET,
  fetchActiveConvoMessages,
  getOpenFileAllowList,
  switchActiveConvoAndMessage,
  throttledFetchConvoBoundaryIds,
} from '@/store/thunks/messages';
import { doubleRequestAnimationFrame, adaptiveRequestAnimationFrame } from '@/utils/dom';
import { CurrentMessageProvider } from './ConvoMessage/CurrentMessageContext';
import ConvoMessageContainer from './ConvoMessageContainer';
import { useMessagesMeta } from './ConvoMessagesHooks/useMessagesMeta';
import { useScrollTo } from './ConvoMessagesHooks/useScrollTo';
import {
  useMarkerIntersectionCallback,
  useMarkerIntersectionObserve,
} from './ConvoMessagesObservers/intersectionObserver/MarkerIntersectionObserverHooks';
import { useConvoContainerRef } from './ConvoMessagesObservers/readObservers';
import PaginationMarker from './PaginationMarker';
import ScrollToButtons from './ScrollToButtons';
import { useVisibleMessages } from './VisibleMessagesProvider';

import styles from './Convo.module.less';

const logger = new Logger('ConvoMessagesContainer');

export type ScrollEventType = 'ScrollToBottom' | 'ScrollToMention' | 'ScrollToError';
const ConvoMessagesContainer = () => {
  const dispatch = useAppDispatch();
  const activeConvoId = useAppSelector(selectActiveConvoId);
  const allMessages = useAppSelector(selectActiveConvoMessages);
  const messages = useMemo(() => {
    return allMessages.filter((m) => !m.isHidden);
  }, [allMessages]);
  const {
    isAddingMoreMessages,
    oldestMsgId,
    oldestUnreadMsgId,
    newestMsgId,
    hasConvoOldestMsg,
    hasConvoNewestMsg,
  } = useMessagesMeta();
  const lastMessagesUpdateReason = useAppSelector(selectActiveConvoLastMessagesUpdateReason);
  const isInitialFetch = lastMessagesUpdateReason === 'initialRendering';

  const convoOldestMsgId = useAppSelector(selectActiveConvoOldestMsgId);
  const convoNewestMsgId = useAppSelector(selectActiveConvoNewestMsgId);
  const convoOldestUnreadMentionId = useAppSelector(selectActiveConvoOldestUnreadMentionId);
  const convoOldestUnreadId = useAppSelector(selectActiveConvoOldestUnreadMsgId);

  const unreadMessagesCount = useAppSelector(selectActiveConvoUnreadMessagesCount);
  const unreadMentionMessagesCount = useAppSelector(selectActiveConvoUnreadMentionMessagesCount);
  const unacknowledgedSendErrorCount = useAppSelector(
    selectActiveConvoUnacknowledgedSendErrorCount
  );

  // track number of rendered messages since initial fetch for perf metrics
  const numRenderedMessage = useRef(0);

  const convoNewestUnackErrorId = useAppSelector(selectActiveConvoNewestUnackErrorId);
  const chatWindowHasFocus = useAppSelector(selectChatWindowHasFocus);
  const extraLogging = useExtraLoggingAfterWakeUp();
  // force a re-rendering, mainly used to reflect ref changes on the ui
  const forceUpdate = useForceUpdate();
  const debugInfo = {
    activeConvoId,
    messages: messages.map((m) => m.msgId),
    convoOldestMsgId,
    convoOldestUnreadId,
    convoOldestUnreadMentionId,
    convoNewestMsgId,
    convoNewestUnackErrorId,
  };
  const debugInfoString = JSON.stringify(debugInfo);
  const prevDebugInfoString = usePrevious(debugInfoString);
  // "cheap" diff check
  if (debugInfoString !== prevDebugInfoString) {
    logger.info('Convo info updated:', debugInfo);
  }

  // keep track of the actual oldest unread message and the one we "pin" the separator to
  const unreadMessageIdForSeparator = useRef<string | undefined>();
  const unreadSeparatorIndex = useRef(-1);
  const [showMoreUnreadButton, setShowMoreUnreadButton] = useState(false);

  // prefer useRef instead of useState to prevent a timing issue that messages are rendered before containerEl state is set
  const virtualListRef = useRef<VirtualListMethods<SingleVirtualListScrollTo>>(null);
  const containerElRef = useConvoContainerRef();
  const scrollableContainerRef = useRef<HTMLElement>(null);
  const containerRefs = useMergeRefs([containerElRef, scrollableContainerRef]);

  // this flag indicates if we are actively fetching older or newer messages, exclude the initial fetching when users enter the convo
  // note that this flag does not change status when we receive new messages through the message addition signal, which is not considered as "actively fetching"
  const [isFetchingMoreMessages, setIsFetchingMoreMessages] = useState(false);
  // similar to isFetchingMoreMessages, this flag tells us if we are rendering older or newer messages
  const isRenderingMoreMessages = useRef(false);
  useMemo(() => {
    if (
      lastMessagesUpdateReason === 'fetchNewerMessages' ||
      lastMessagesUpdateReason === 'fetchOlderMessages'
    ) {
      isRenderingMoreMessages.current = true;
    }
  }, [messages]);

  /**
   * The willLoadFutureMessages flag determines whether incoming messages, appearing after the current ones, will be loaded
   * PS: the term "incoming messages" means the new messages we receive from messsage added signal
   *
   * We would want to load incoming messages if
   *   1. Newest messages are loaded
   *
   * We would NOT want to load incoming messages if
   *   1. User enter a convo with many unread messages, and we only load messages around the unread message,
   *      newest messages are not loaded yet, so we don't want to render any incoming messages until user scrolls to bottom
   */
  const willLoadFutureMessages = useRef(false);

  // if the ConvoNewestMsg is loaded, meaning we will continue to load more future messages, so set the flag
  if (hasConvoNewestMsg && !willLoadFutureMessages.current) {
    logger.info('found convo newest message', 'set willLoadFutureMessages to true');
    willLoadFutureMessages.current = true;
  }

  const [preloadOffset, setPreloadOffset] = useState(0);

  const [isScrolledToBottom, scrollTo, handleScrollPositionStateChange] = useScrollTo(
    virtualListRef,
    isAddingMoreMessages,
    oldestUnreadMsgId,
    willLoadFutureMessages.current
  );

  // Use auto-summary hook to generate summaries for unread messages
  useAutoSummary({
    activeConvoId,
    oldestUnreadMsgId,
    lastMessagesUpdateReason,
    virtualListRef,
  });

  useVisibleMessages(({ newVisibleMessages, startIndex, visibleMessages }) => {
    // calculate indices for messages to be observed to trigger messages prefetch
    let observedIndexOlder = PREFETCH_OLDER_MESSAGES_OFFSET - 1;
    let observedIndexNewer = messages.length - PREFETCH_NEWER_MESSAGES_OFFSET;

    // if the indices overlap, use a middle index for both.
    if (observedIndexNewer < observedIndexOlder) {
      const middleIndex = Math.round((observedIndexOlder + observedIndexNewer) / 2);
      observedIndexOlder = observedIndexNewer = middleIndex;
    }

    // fetch older or newer messages if message to be observed becomes visible
    if (newVisibleMessages.find((m) => m.msgId === messages[observedIndexOlder]?.msgId)) {
      fetchOlderMessages();
    } else if (newVisibleMessages.find((m) => m.msgId === messages[observedIndexNewer]?.msgId)) {
      fetchNewerMessages();
    }

    // case is hidden -> show when not focused and separator is on top
    // case is showing -> hide when separator moves into view
    setShowMoreUnreadButton(
      (!chatWindowHasFocus || showMoreUnreadButton) &&
        unreadSeparatorIndex.current !== -1 &&
        unreadSeparatorIndex.current < startIndex
    );

    if (extraLogging.current) {
      logger.info(
        '[Debug Missing Messages] visible messages are',
        visibleMessages.map((m) => m.msgId)
      );
    }
  });

  useEffect(() => {
    dispatch(getOpenFileAllowList());
  }, []);

  useEffect(() => {
    if (unreadMentionMessagesCount || unacknowledgedSendErrorCount) {
      dispatch(throttledFetchConvoBoundaryIds(activeConvoId));
    }
  }, [unreadMentionMessagesCount, unacknowledgedSendErrorCount]);

  const leadingPaginationRef = useMarkerIntersectionObserve('leading');
  const trailingPaginationRef = useMarkerIntersectionObserve('trailing');

  // react-intersection-observer is state based, intersection result (useEffect) can be delayed when event loop is busy, which could cause double fetching issue
  // our useIntersection hook runs "synchronously", which should keep the intersection state up to date
  useMarkerIntersectionCallback((data) => {
    data.forEach((datum) => {
      if (!datum.entry?.isIntersecting) return;
      if (datum.data === 'leading') {
        fetchOlderMessages();
      } else if (datum.data === 'trailing') {
        fetchNewerMessages();
      }
    });
  });

  const fetchOlderMessages = useLatestCallback(() => {
    if (!containerElRef.current) return;
    if (hasConvoOldestMsg) return;
    if (!messages.length) return;
    if (isFetchingMoreMessages) return;
    setIsFetchingMoreMessages(true);
    logger.info('fetchOlderMessages', oldestMsgId);
    // after setting isFetchingMoreMessages to true, spinner will start spinning, but it takes time
    //   - if we start fetching and rendering messages right after setting the flag, spinner animation won't play until thread becomes less busy
    //   - calling double raf here should give spinner enough time to start animation, once the animation is started, browser will prioritize it
    //     over JS execution, so it will keep spinning even if thread is busy
    doubleRequestAnimationFrame(() => {
      dispatch(
        fetchActiveConvoMessages({
          msgId: oldestMsgId,
          before: FETCH_OLDER_MESSAGES_INCREMENTAL,
          after: 0,
          reason: 'fetchOlderMessages',
        })
      ).then(() => {
        /**
         * Before we change the flag, give component extra time to receive and ignore keydown events during rendering
         * @see handleOnKeyDownCapture
         */
        adaptiveRequestAnimationFrame(() => {
          isRenderingMoreMessages.current = false;
        });
        setIsFetchingMoreMessages(false);
      });
    });
  });

  const fetchNewerMessages = useLatestCallback(() => {
    if (!containerElRef.current) return;
    if (hasConvoNewestMsg) return;
    if (!messages.length) return;
    if (willLoadFutureMessages.current) return;
    if (isFetchingMoreMessages) return;
    setIsFetchingMoreMessages(true);
    logger.info('fetchNewerMessages', newestMsgId);
    /**
     * @see fetchOlderMessages
     */
    doubleRequestAnimationFrame(() => {
      dispatch(
        fetchActiveConvoMessages({
          msgId: newestMsgId,
          before: 0,
          after: FETCH_NEWER_MESSAGES_INCREMENTAL,
          reason: 'fetchNewerMessages',
        })
      ).then(() => {
        /**
         * Before we change the flag, give component extra time to receive and ignore keydown events during rendering
         * @see handleOnKeyDownCapture
         */
        adaptiveRequestAnimationFrame(() => {
          isRenderingMoreMessages.current = false;
        });
        setIsFetchingMoreMessages(false);
      });
    });
  });

  useEffect(() => {
    if (!messages.length) return;
    logger.info('useEffect(Messages)', 'isInitialFetch', isInitialFetch);
    logger.info(
      'useEffect(Messages)',
      'newest message timestamp',
      messages[messages.length - 1]?.timeStamp
    );

    if (isInitialFetch && !hasConvoNewestMsg) {
      logger.info(
        'no newest message found on initial fetch',
        'set willLoadFutureMessages to false'
      );
      willLoadFutureMessages.current = false;
      forceUpdate();
    }

    // send ConvoSwitchEnd metric when users enter a convo
    if (isInitialFetch) {
      doubleRequestAnimationFrame(() => {
        metricEvents.emit('ConvoSwitchEnd', {
          vgroupId: activeConvoId,
          numMessagesRendered: numRenderedMessage.current,
        });
      });
    }
  }, [messages]);

  const handleScrollToButtonsWheel = (event: SyntheticEvent<HTMLElement, WheelEvent>) => {
    if (containerElRef.current) {
      containerElRef.current.scrollLeft += event.nativeEvent.deltaX;
      containerElRef.current.scrollTop += event.nativeEvent.deltaY;
    }
  };

  const getScrollToMsgId = (button: ScrollEventType) => {
    switch (button) {
      case 'ScrollToBottom':
        return convoNewestMsgId;
      case 'ScrollToMention':
        return convoOldestUnreadMentionId;
      case 'ScrollToError':
        return convoNewestUnackErrorId;
      default:
        break;
    }
  };

  const handleScrollToButtonClick = (button: ScrollEventType) => {
    const msgId = getScrollToMsgId(button);
    if (msgId) {
      dispatch(
        switchActiveConvoAndMessage({
          scrollToMsgId: msgId,
        })
      );
      metricEvents.emit('ScrollEventStart', { scrollType: button });
    }
  };

  const renderedMessages = useMemo(() => {
    // convoOldestMsgId is undefined:     we are still fetching boundaryIds
    // convoOldestMsgId is '':            the convo doesn't have any messages
    // convoOldestMsgId is 'non-empty':   the convo has messages
    // messages.length is 0:              we are still fetching messages, or the convo doesn't have any messages
    // messages.length is > 0:            messages are fetched and stored in redux
    //
    // show a loading spinner when users enter a convo
    //   - when they enter the convo, messages are not yet fetched and loaded, so messages.length can be 0
    //   - once messages.length becomes non-zero, meaning messages are loaded, we can remove the spinner and render the messages
    //   - when convoOldestMsgId is not empty, it is implied that this convo has messages, otherwise this convo is empty then we don't need to show spinner
    //   - so combine these two, this if statement means "when this convo has messages but not yet loaded, we should show spinner"
    if (messages.length === 0 && convoOldestMsgId !== '') {
      // do not preload any messages outside of visible area while entering the convo
      setPreloadOffset(0);
      return <PaginationMarker markerType="center" />;
    } else {
      if (lastMessagesUpdateReason === 'initialRendering') {
        doubleRequestAnimationFrame(() => {
          // after convo messages are loaded, preload more messages
          setPreloadOffset(500);
        });
      }
      // The unread separator should not "follow" the latest unread message, so we peg it when we switch to convo (initial rendering).
      // We also update if the chat window is not in focus, because coming back to the app is like a convo switch.
      if (
        (!unreadMessageIdForSeparator.current && lastMessagesUpdateReason === 'initialRendering') ||
        !chatWindowHasFocus
      ) {
        // we know findIndex will return -1 if oldestUnreadMsgId is undefined
        const unreadIndex = oldestUnreadMsgId ? messages.findIndex((m) => !m.isRead) : -1;
        const unreadId = messages[unreadIndex]?.msgId;
        if (unreadMessageIdForSeparator.current !== unreadId) {
          unreadMessageIdForSeparator.current = unreadId;
          unreadSeparatorIndex.current = unreadIndex;
        }
      }
      return (
        <VirtualList
          id="convo-messages"
          ref={virtualListRef}
          preloadOffset={preloadOffset}
          scrollAnchor={{ insideAnchorSelector: '[data-anchor-chat-bubble]' }}
          scrollTo={scrollTo}
          className={styles.convoMessagesContainerContent}
          items={messages}
          itemHeightType="dynamic"
          keySelector={(message) => {
            return message.msgId;
          }}
          onScrollPositionStateChange={handleScrollPositionStateChange}
          extraLoggingEnabled={extraLogging.current}
          renderItem={(message, index) => {
            numRenderedMessage.current++;
            const prevMessage: WickrMessage | undefined = messages[index - 1];
            return (
              <CurrentMessageProvider msgId={message.msgId} convoId={message.vGroupID}>
                <ConvoMessageContainer
                  id={message.msgId}
                  message={message}
                  prevMessage={prevMessage}
                  showUnreadSeparator={message.msgId === unreadMessageIdForSeparator.current}
                  isLastMessage={index === messages.length - 1}
                  onUnmountBlur={() => {
                    // focus convo message container if the message is focused while unmounting
                    containerElRef.current?.focus();
                  }}
                />
              </CurrentMessageProvider>
            );
          }}
          dependencies={[unreadMessageIdForSeparator.current]}
          // message element height estimator
          // the estimate height doesn't affect virtual list functionalities
          // but accurate estimation will improve performance
          initialItemHeight={(message) => {
            let totalHeight = 0;
            if (message.control) {
              totalHeight = 18;
            } else if (message.textContent.length) {
              const messageContentWidth = 1024;
              const widthPerChar = 6.75;
              const heightPerLine = 21;
              const lines = message.textContent.split(/\r?\n/);
              for (const line of lines) {
                const numLines = Math.ceil((line.length * widthPerChar) / messageContentWidth) ?? 1;
                totalHeight += numLines * heightPerLine;
              }
              if (message.text?.links) {
                totalHeight += message.text?.links.length * 52;
              }
              if (message.inReplyTo) {
                totalHeight += 80;
              }
              totalHeight += 50; // base height
            } else {
              totalHeight = 100;
            }
            /**
             * When rendering a convo that contains unread messages, we add extra height for the newest message during the initial rendering.
             *
             * Why?
             *
             * Upon the initial load of a conversation, we need to scroll to the oldest unread message. The steps involved are:
             *
             * 1. Estimate Item Heights: Use estimated heights for each message to calculate their top positions and the total list height.
             * 2. Initial Scroll Position: Scroll to the top position of the oldest unread message based on these estimates.
             * 3. Recalculate After Rendering: Once the actual heights of the messages are measured, recalculate the item positions and list height.
             * 4. Adjust Scroll Position: Adjust the scroll position to ensure the oldest unread message remains at the top of the view.
             *
             * The Problem:
             *
             * This process usually works well. However, issues arise when the estimated total height of the unread messages is smaller than the container height, but their actual total height is greater. In such cases, we cannot scroll to the correct position.
             *
             * Example Scenario:
             *
             * 1. Messages: We have three messages—A (read), B (unread), and C (unread).
             * 2. Estimated Heights:
             *    - Message A: 100px
             *    - Message B: 100px
             *    - Message C: 100px
             *    - Container Height: 300px
             * 3. Total Estimated Height of B and C: 200px, which is less than the container height of 300px.
             * 4. Attempted Scroll: We set `container.scrollTop = 100`, expecting message B to appear at the top of the view.
             * 5. Issue: The browser prevents over-scrolling since the total list height isn't greater than container height, the `scrollTop` is auto adjusted to 0px, effectively scrolling to the bottom of the list.
             * 6. Message B appears in the middle of the view instead of at the top, causing a 100px discrepancy.
             *    - Note: If the estimated heights are equal to or greater than the actual heights, this issue does not occur because it will attempt to over-scroll anyway when actual heights applied.
             * 8. Suppose the actual heights are:
             *    - Message A: 100px
             *    - Message B: 200px
             *    - Message C: 200px
             * 9. Expected Behavior with Actual Heights: The combined height of B and C is 400px, exceeding the container height. Setting `scrollTop` to 100px should position message B correctly without over-scrolling.
             * 10. Problem Due to Incorrect Estimates: The incorrect estimated heights lead to a 100px error in the scroll position.
             *
             * To fix it, we add extra height for the newest message during the initial rendering, which gives vList extra room to set initial scroll position which doesn't cause over-scrolling.
             *
             * Caveats
             *   1. With larger initial height, vList will try to render less messages on initial rendering and more messages on next rendering phase (after heights are measured)
             *      althought the process is invisible to user, it can make vList slightly less efficient
             *
             * TODO: more accurate height estimation?
             */
            if (
              lastMessagesUpdateReason === 'initialRendering' && // on initial convo load
              message.msgId === newestMsgId && // message is the newest message
              unreadMessageIdForSeparator.current // there are unread messages
            ) {
              totalHeight += 250; // 250 may or may not enough, but better than no adjustment
            }

            return totalHeight;
          }}
          header={
            <PaginationMarker
              hidden={!messages.length || hasConvoOldestMsg}
              markerType="leading"
              ref={leadingPaginationRef}
              playAnimation={isFetchingMoreMessages}
            />
          }
          footer={
            /* Control bottom pagination marker based on convoNewestMsgId can be dangerous
                1. The loaded newest mesage may not be the convoNewestMsg due to the arriving order, details: https://quip-amazon.com/8PpaA6z1ppam/Wickr-Chat-Message-Fetch-And-Rendering-Flow#temp:C:cUef964b43837a2478a90d38d4f0
                2. convoNewestMsgId may not be up to date when multiple messages are received at the same time
                The flag willLoadFutureMessages is accurate since it reflects overall loading status and thus not affected by individual message */
            <>
              <PaginationMarker
                hidden={!messages.length || willLoadFutureMessages.current}
                markerType="trailing"
                ref={trailingPaginationRef}
                playAnimation={isFetchingMoreMessages}
              />
            </>
          }
        />
      );
    }
  }, [
    messages,
    preloadOffset,
    convoOldestMsgId,
    lastMessagesUpdateReason,
    chatWindowHasFocus,
    scrollTo,
    isFetchingMoreMessages,
    hasConvoOldestMsg,
  ]);

  const handleOnKeyDownCapture = (e: React.KeyboardEvent<HTMLDivElement>) => {
    // ignore scroll events raised by keys (arrows, Page Up, Page Down) during messages rendering
    // this prevents queued keydown events from causing unexpected scrolling after rendering finishes
    if (isRenderingMoreMessages.current) {
      e.preventDefault();
    }
  };

  return (
    <div
      ref={containerRefs}
      onKeyDownCapture={handleOnKeyDownCapture}
      className={styles.convoMessagesContainer}
    >
      {renderedMessages}
      {!!messages.length && (
        // isScrolledToBottom will quickly switch from false to true when loading a convo with no unreads
        // causing scroll to button flash in and flash out, adding a timeout for rendering should fix it
        // AFAIK this is the only drawback of removing needsScrolledToUnreadRef flag
        <>
          <DelayRender mode="timeout" delay={1}>
            <ScrollToButtons
              onClick={handleScrollToButtonClick}
              onWheel={handleScrollToButtonsWheel}
              mentionCount={unreadMentionMessagesCount ?? 0}
              unreadCount={unreadMessagesCount ?? 0}
              isScrolledToBottom={isScrolledToBottom}
              errorCount={unacknowledgedSendErrorCount ?? 0}
            />
          </DelayRender>
          <MoreUnreadFAB
            visible={showMoreUnreadButton}
            onClick={() => {
              dispatch(
                switchActiveConvoAndMessage({
                  scrollToMsgId: unreadMessageIdForSeparator.current,
                })
              );
            }}
          />
        </>
      )}
    </div>
  );
};

export default ConvoMessagesContainer;
