import { RefObject, useEffect, useRef } from 'react';

import { getPaginatedMessages } from '../apis/webFetch';
import { VirtualListMethods } from '../componentlibrary/VirtualList/VirtualListContainer';
import { AnchorType, SingleVirtualListScrollTo } from '../componentlibrary/VirtualList/types';
import { Logger } from '../lib/logger';
import { useWickrAIChat } from '../lib/mcp/useWickrAIChat';
import { WickrMessage, WickrMessageType } from '../lib/protobuf/messages';
import { useAppDispatch, useAppSelector } from '../store';
import { useFeature } from '../store/hooks/useFeature';
import { useSetting } from '../store/hooks/useSetting';
import {
  selectActiveConvoMessages,
  upsertConvoMessages,
  removeManyConvoMessages,
} from '../store/slices/convos';
import { StreamChunk } from '@/lib/bedrock/types';
import { selectScrollToMsgId } from '@/store/slices/uiChat';
import { useAsyncEffect } from './useAsyncEffect';
import useLatestCallback from './useLatestCallback';

const logger = new Logger('useAutoSummary');

interface UseAutoSummaryProps {
  activeConvoId: string;
  oldestUnreadMsgId: string | undefined;
  lastMessagesUpdateReason: string | undefined;
  virtualListRef: RefObject<VirtualListMethods<SingleVirtualListScrollTo>>;
}

// Maximum character limit for model input to prevent exceeding token limits
const MODEL_INPUT_CHAR_LIMIT = 16384;
// Ratio to estimate output tokens based on input character count
const MODEL_OUTPUT_TOKEN_RATIO = 0.2;
// Minimum number of output tokens to ensure meaningful summary generation
const MODEL_MIN_OUTPUT_TOKENS = 64;
// Maximum number of output tokens to prevent excessive generation costs
const MODEL_MAX_OUTPUT_TOKENS = 4096;
// Number of messages to fetch in a single batch when retrieving unread messages
const UNREAD_MESSAGES_BATCH_SIZE = 512;
// Character limit for truncating individual messages to fit within input limits
const MESSAGE_TRUNCATION_CHAR_LIMIT = 256;
// Minimum number of messages required before triggering auto-summary generation
const MIN_MESSAGE_COUNT_FOR_SUMMARY = 8;
// Minimum total content length required before triggering auto-summary generation
const MIN_CONTENT_LENGTH_FOR_SUMMARY = 1024;
// Word count multiplier for summary length guidance (applied to maxTokens)
const SUMMARY_WORD_COUNT_MULTIPLIER = 0.75;
export const useAutoSummary = ({
  activeConvoId,
  oldestUnreadMsgId,
  lastMessagesUpdateReason,
  virtualListRef,
}: UseAutoSummaryProps) => {
  const dispatch = useAppDispatch();
  const currentMessages = useAppSelector(selectActiveConvoMessages);
  const wickrAIEnabled = useFeature('WickrAI');
  const autoSummaryEnabled = useSetting('autoSummaryEnabled') && wickrAIEnabled;
  const scrollToMsgId = useAppSelector(selectScrollToMsgId);

  const { sendMessage, isReady, onStreamChunk, offStreamChunk, stopGeneration } = useWickrAIChat(
    undefined,
    true,
    false
  );
  const summaryMessageRef = useRef<WickrMessage | null>(null);
  const autoSummaryTriggeredRef = useRef(false);
  useAsyncEffect(async () => {
    // Return early if auto summary is disabled
    if (!autoSummaryEnabled) {
      return;
    }

    // Step 1: Remove existing auto-summary messages
    if (!autoSummaryTriggeredRef.current) {
      const existingAutoSummaryMessages = currentMessages.filter((msg) => msg.isAutoSummaryMessage);
      if (existingAutoSummaryMessages.length > 0) {
        logger.info(
          'Removing existing auto-summary messages',
          existingAutoSummaryMessages.map((m) => m.msgId)
        );
        dispatch(
          removeManyConvoMessages({
            vGroupID: activeConvoId,
            ids: existingAutoSummaryMessages.map((m) => m.msgId),
            reason: 'updateMessage',
          })
        );
      }
    }

    // Only run on initial rendering and when we have unread messages
    if (
      lastMessagesUpdateReason !== 'initialRendering' ||
      !oldestUnreadMsgId ||
      !activeConvoId ||
      !isReady ||
      autoSummaryTriggeredRef.current
    ) {
      return;
    }
    autoSummaryTriggeredRef.current = true;

    logger.info('useAutoSummary triggered', { activeConvoId, oldestUnreadMsgId });

    try {
      // Step 2: Fetch unread messages
      logger.info('Fetching unread messages from', oldestUnreadMsgId);
      const unreadMessages = (
        await getPaginatedMessages({
          vGroupID: activeConvoId,
          msgId: oldestUnreadMsgId,
          before: 0,
          after: UNREAD_MESSAGES_BATCH_SIZE,
        })
      ).messages;

      logger.info('Fetched unread messages', { count: unreadMessages.length });

      // Step 3: Combine messages to analysis string
      let messagesContent = unreadMessages
        .flatMap((msg) => msg.senderUserName + ':' + msg.textContent)
        .join('\n');

      if (messagesContent.length > MODEL_INPUT_CHAR_LIMIT) {
        messagesContent = unreadMessages
          .flatMap(
            (msg) =>
              msg.senderUserName + ':' + msg.textContent.substring(0, MESSAGE_TRUNCATION_CHAR_LIMIT)
          )
          .join('\n');
      }

      if (messagesContent.length > MODEL_INPUT_CHAR_LIMIT) {
        messagesContent = messagesContent.substring(0, MODEL_INPUT_CHAR_LIMIT);
      }

      if (
        unreadMessages.length < MIN_MESSAGE_COUNT_FOR_SUMMARY &&
        messagesContent.length < MIN_CONTENT_LENGTH_FOR_SUMMARY
      ) {
        return;
      }

      // Step 5: Generate new summary
      // Create initial summary message with empty content
      const oldestUnreadMessage = unreadMessages.find((msg) => !msg.isRead);
      const summaryMessage = createSummaryMessage(
        activeConvoId,
        '',
        oldestUnreadMessage?.timeStamp
      );
      summaryMessageRef.current = summaryMessage;
      // don't take over the anchor of scrollTo message
      if (!scrollToMsgId) {
        virtualListRef.current?.setScrollAnchor(
          { itemKey: summaryMessage.msgId },
          AnchorType.Primary
        );
      }

      // Insert initial summary message
      dispatch(
        upsertConvoMessages({
          vGroupID: activeConvoId,
          messages: [summaryMessage],
          reason: 'updateMessage',
        })
      );

      // Set up streaming handler
      onStreamChunk(streamHandler);
      const maxTokens = Math.min(
        Math.max(
          Math.round(messagesContent.length * MODEL_OUTPUT_TOKEN_RATIO),
          MODEL_MIN_OUTPUT_TOKENS
        ),
        MODEL_MAX_OUTPUT_TOKENS
      );
      // Generate summary
      const summaryPrompt = `You are Chat-Notes, a laser-focused chat summarizer.  
• Objective: distill the unread messages into clear, actionable takeaways.  
• Style rules  
  – Jump straight to the points (no “Here is a summary…” preamble).  
  – One paragraph or bullet per idea.  
  – **Bold** crucial terms, names, or dates.  
  – Tag each item with (Author) when the speaker matters.  
  – Capture decisions, open questions, and blockers.  
  – If concrete tasks appear, end with a “**Next Steps:**” bullet list.  
  – Do **not** quote messages verbatim.  
  – No greetings, sign-offs, or extra commentary.  
  - Keep the summary output within ${maxTokens * SUMMARY_WORD_COUNT_MULTIPLIER} words

Messages:
${messagesContent}`;

      await sendMessage(summaryPrompt, {
        inferenceConfig: {
          maxTokens,
        },
      });

      logger.info('Summary generation completed');
    } catch (error) {
      logger.error('Error generating auto summary:', error);
    } finally {
      offStreamChunk();
      summaryMessageRef.current = null;
    }
  }, [
    activeConvoId,
    oldestUnreadMsgId,
    lastMessagesUpdateReason,
    isReady,
    sendMessage,
    onStreamChunk,
    offStreamChunk,
    dispatch,
    currentMessages,
    autoSummaryEnabled,
    scrollToMsgId,
  ]);

  const streamHandler = useLatestCallback((chunk: StreamChunk) => {
    if (
      !summaryMessageRef.current // summary message is not yet created or removed by this hook
    ) {
      return;
    }
    // summary message is removed due to scrolling to out of view messsage
    if (!currentMessages.find((m) => m.msgId === summaryMessageRef.current?.msgId)) {
      stopGeneration();
      offStreamChunk();
      return;
    }

    if (chunk.type === 'content' && chunk.content) {
      // Update summary message content in real-time
      summaryMessageRef.current = {
        ...summaryMessageRef.current,
        textContent: summaryMessageRef.current.textContent + chunk.content,
      };

      dispatch(
        upsertConvoMessages({
          vGroupID: activeConvoId,
          messages: [summaryMessageRef.current],
          reason: 'updateMessage',
        })
      );
    }
  });

  useEffect(() => {
    return () => {
      stopGeneration();
      offStreamChunk();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
};

// Helper function to create auto-summary message
const createSummaryMessage = (
  vGroupID: string,
  content: string,
  referenceTimestamp?: number
): WickrMessage => {
  const now = Date.now();
  const timeStamp = referenceTimestamp ? referenceTimestamp - 1 : now;

  return {
    type: WickrMessageType.MsgType_Text,
    vGroupID,
    senderHash: '',
    isRead: true,
    timeStamp,
    timeStampMicroseconds: timeStamp * 1000,
    starred: false,
    destructTime: 0,
    ttl: 0,
    bor: 0,
    msgId: `auto-summary-${now}`,
    retryCount: 0,
    outbox: false,
    unacknowledgedSendError: false,
    rrReceived: false,
    rrTimestamp: 0,
    msgTranslation: {},
    origSendTimestamp: 0,
    isDelayed: false,
    wickrError: [],

    // Message body
    senderUserName: 'WickrAI',
    text: {
      markdownVersion: 2,
      text: content,
    },
    keyVerify: null,
    control: null,
    file: null,
    callmessage: null,
    location: null,
    edit: null,
    decryptionError: null,
    reactionMessage: null,
    editContent: null,
    targetUsers: [],
    targetUsersv2: [],
    editTimestamp: null,
    inReplyTo: null,
    uploadErrors: [],
    reactions: [],
    isContentEdited: null,

    // Local props
    textContent: content,
    msgTranslationPending: false,
    isAutoSummaryMessage: true,
  };
};
