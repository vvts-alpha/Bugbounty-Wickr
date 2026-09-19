// eslint-disable-next-line lodash/import-scope
import { DebouncedFunc } from 'lodash';
import {
  removeConvoMessage,
  removeConvoMessagesByCount,
  selectActiveConvoMessages,
  selectConvoMessage,
  upsertMessagesMetadata,
  upsertConvoMessages,
  removeAllConvoMessages,
  starConvoMessage,
  selectConvoMessages,
  removeManyConvoMessages,
  RemoveMessagesActionPayload,
  setMessagePendingEdit,
  clearConvoBotWarning,
  selectActiveConvoBoundaryIds,
  selectConvoOldestMsgId,
  selectConvoNewestMsgId,
  selectActiveConvoHasUnauthorizedMembers,
} from '../slices/convos';
import { MessagesUpdateReason } from '../slices/convos/messagesAdapter';
import { selectSelfUserIdHash } from '../slices/identity';
import { selectIsActivePanel } from '../slices/panels';
import { removeDeletedSearchItem } from '../slices/roomSearch';
import { selectActiveConvoId } from '../slices/shared';
import {
  selectScrollToMsgId,
  setActiveConvoId,
  setDraftMessage,
  setScrollToMsgId,
  clearScrollToMsgId,
} from '../slices/uiChat';
import { selectDirectoryUserByIdHash, upsertUsers } from '../slices/users';
import { createAppAsyncThunk } from '../utils';
import {
  MarkMessageReadPayload,
  SendTextMessagePayload,
  StarMessagePayload,
  EmojiReactMessagePayload,
  SendVoiceMemoPayload,
  SendTypingActivityPayload,
  CreateDMPayload,
  ResendMessagePayload,
  AckMessageSendFailurePayload,
  ClearBotWarningPayload,
  ReportErrorPayload,
  CreateGroupPayload,
  CreateRoomPayload,
  DeleteMessagePayload,
  ForwardMessagePayload,
} from '@/apis/webChannel/BridgeWebChannel';
import { JoinCallPayload } from '@/apis/webChannel/UIBridgeWebChannel';
import {
  getPaginatedMessages,
  getUser,
  getUserById,
  PaginatedMessagesPayload,
  reactToMessage,
} from '@/apis/webFetch';
import { Logger } from '@/lib/logger';
import { metricEvents } from '@/lib/metrics';
import {
  FetchMessagesPayload,
  GroupAndMsgAndTempMsgId,
  GroupAndMsgId,
  SpecialMsgId,
  WickrMessage,
  WickrMessageCollection,
} from '@/lib/protobuf/messages';
import { throttle } from '@/utils/function';
import { redactInProd } from '@/utils/strings';
import { markdownToJSON } from '@/utils/tiptap/markdown';
import { fetchActiveConvo } from './convos';
import { convertDirectoryUserToContact } from './users';

const logger = new Logger('store/chat');

/**
 * Specifies the offset for prefetching older messages before the user reaches the top of the message view
 * When the user views the Nth message from the top, we will begin to fetch older messages
 */
export const PREFETCH_OLDER_MESSAGES_OFFSET = 5;
/**
 * Specifies the offset for prefetching newer messages before the user reaches the bottom of the message view
 * When the user views the Nth message from the bottom, we will begin to fetch newer messages
 */
export const PREFETCH_NEWER_MESSAGES_OFFSET = 5;
/** The number of older messages we want to fetch when user enters a convo */
export const FETCH_OLDER_MESSAGES_INITIAL = 25;
/** The number of newer messages we want to fetch when user enters a convo */
export const FETCH_NEWER_MESSAGES_INITIAL = 25;
/** The number of older messages we want to fetch when user scroll up to top */
export const FETCH_OLDER_MESSAGES_INCREMENTAL = 25;
/** The number of older messages we want to fetch when user scroll down to bottom */
export const FETCH_NEWER_MESSAGES_INCREMENTAL = 25;

/** Switch to a given conversation, and scroll to the message, if given */
export const switchActiveConvoAndMessage = createAppAsyncThunk(
  `messages/switchActiveConvoAndMessage`,
  async (
    { vGroupID, scrollToMsgId }: { vGroupID?: string; scrollToMsgId?: string },
    { dispatch, getState }
  ) => {
    // empty string will break ?? operator, so make it undefined when falsey
    scrollToMsgId ||= undefined;
    const currentActiveConvoId = selectActiveConvoId(getState());
    if (!vGroupID) {
      vGroupID = currentActiveConvoId;
    }
    const isDiffConvo = currentActiveConvoId !== vGroupID;

    const currentScrollToMsg = selectScrollToMsgId(getState());
    // when comparing it, convert all undefined to empty string, as we might hit an edge case that compares undefined with empty string
    const isDiffMsg = (currentScrollToMsg ?? '') !== (scrollToMsgId ?? '');
    logger.info('switchActiveConvoAndMessage', {
      currentActiveConvoId,
      currentScrollToMsg,
      vGroupID,
      scrollToMsgId,
      isDiffConvo,
      isDiffMsg,
    });

    if (!isDiffConvo && !isDiffMsg) return;

    const promises: Promise<any>[] = [];
    let isScrollToMsgInRedux = false;
    if (isDiffConvo) {
      metricEvents.emit('ConvoSwitchStart', { vgroupId: vGroupID });
      dispatch(setActiveConvoId(vGroupID));
      dispatch(clearScrollToMsgId());
      promises.push(dispatch(fetchActiveConvo()));
    } else {
      // in case it's not a different convo, we should search scrollToMsgId in target convo
      const messages = selectConvoMessages(getState(), vGroupID);
      isScrollToMsgInRedux = !!messages.find((message) => message.msgId === scrollToMsgId);
    }

    // make sure convo container has scrollToMsgId set before upserting messages
    // otherwise it will follow default scroll behavior first (scroll to unread or bottom)
    // eslint-disable-next-line no-restricted-syntax
    dispatch(setScrollToMsgId(scrollToMsgId));

    // if it's different convo or target convo doesn't have the message we want to scroll to
    if (isDiffConvo || !isScrollToMsgInRedux) {
      dispatch(
        removeAllConvoMessages({ vGroupID: currentActiveConvoId, reason: 'initialRendering' })
      );
      promises.push(
        dispatch(
          fetchActiveConvoMessages({
            msgId: scrollToMsgId ?? SpecialMsgId.UNREAD,
            before: FETCH_OLDER_MESSAGES_INITIAL,
            after: FETCH_NEWER_MESSAGES_INITIAL,
            reason: 'initialRendering',
          })
        )
      );
    }

    return Promise.all(promises);
  }
);

export const fetchAndUpsertMessage = createAppAsyncThunk(
  `messages/fetchAndUpsertMessage`,
  async (
    {
      vGroupID,
      msgId,
      tempMsgId,
      reason,
    }: GroupAndMsgAndTempMsgId & { reason: MessagesUpdateReason },
    { dispatch }
  ): Promise<WickrMessage | undefined> => {
    const collection = await getPaginatedMessages({
      vGroupID,
      msgId,
      before: 1,
      after: 1,
    });

    const message = await dispatch(
      upsertMessage({ vGroupID, msgId, tempMsgId, reason, messageCollection: collection })
    ).unwrap();
    return message;
  }
);

// IMPORTANT: This thunk is designed to handle high concurrency, we need to make sure it remains efficient and capable of running with overlap whenever new changes are implemented
export const upsertMessage = createAppAsyncThunk(
  `messages/upsertMessage`,
  async (
    {
      vGroupID,
      msgId,
      tempMsgId,
      reason,
      messageCollection,
    }: GroupAndMsgAndTempMsgId & { reason: MessagesUpdateReason } & {
      messageCollection: WickrMessageCollection;
    },
    { getState, dispatch, extra }
  ): Promise<WickrMessage | undefined> => {
    // get two messages around target message, it will help cache determine if the message can be connected to other messages

    const { messages, hasMoreBefore, hasMoreAfter } = messageCollection;
    logger.info('fetchMessage', vGroupID, msgId, tempMsgId, reason);
    logger.info(
      'fetchMessage',
      messages.map((m) => ({
        msgId: m.msgId,
        isRead: m.isRead,
        timeStamp: m.timeStamp,
      }))
    );
    logger.info('fetchMessage', `hasMoreBefore: ${hasMoreBefore}`, `hasMoreAfter: ${hasMoreAfter}`);
    const cache = extra.messageCaches.getOrCreate(vGroupID);
    const fetchedMessageIndex = messages.findIndex((m) => m.msgId === msgId);
    const fetchedMessage = messages[fetchedMessageIndex];
    if (!fetchedMessage) {
      logger.warn('fetchMessage: no message found matching:', { vGroupID, msgId });
      return;
    }
    const previousMessage = messages[fetchedMessageIndex - 1];

    // we should clear temp msg when server msgId is available
    const shouldClearTempMsg = tempMsgId && msgId !== tempMsgId;

    if (shouldClearTempMsg) {
      extra.bridge.clearMessageTempId({ vgroupId: vGroupID, tempMessageId: tempMsgId });
      cache.delete(tempMsgId);
      if (fetchedMessage.unacknowledgedSendError) {
        dispatch(fetchConvoBoundaryIds(vGroupID));
      }
    }
    cache.upsertMany(messages);

    // get current boundary ids from redux
    const currentOldestMsgId = selectConvoOldestMsgId(getState(), vGroupID);
    const currentNewestMsgId = selectConvoNewestMsgId(getState(), vGroupID);
    // get current boundary messages from cache
    const currentOldestMsg = currentOldestMsgId ? cache.get(currentOldestMsgId) : undefined;
    const currentNewestMsg = currentNewestMsgId ? cache.get(currentNewestMsgId) : undefined;
    // if exists, get new boundary messages from fetched messages
    const newOldestMsg = hasMoreBefore === false ? messages[0] : undefined;
    const newNewestMsg = hasMoreAfter === false ? messages[messages.length - 1] : undefined;

    let newOldestMsgId = newOldestMsg?.msgId ?? currentOldestMsgId;
    // compare current and new boundary messages by timestamp, and select the boundary ids with newer timestamps
    if (currentOldestMsg && newOldestMsg) {
      // when both messages are found
      if (newOldestMsg.timeStamp > currentOldestMsg.timeStamp) {
        // compare timestamp, choose newer one as the boundary id)
        newOldestMsgId = newOldestMsg.msgId;
      } else {
        newOldestMsgId = currentOldestMsg.msgId;
      }
    }
    // compare current and new boundary messages by timestamp, and select the boundary ids with newer timestamps
    let newNewestMsgId = newNewestMsg?.msgId ?? currentNewestMsgId;
    if (currentNewestMsg && newNewestMsg) {
      if (newNewestMsg.timeStamp > currentNewestMsg.timeStamp) {
        newNewestMsgId = newNewestMsg.msgId;
      } else {
        newNewestMsgId = currentNewestMsg.msgId;
      }
    }
    // update boundary in cache, for better caching performance
    cache.updateBoundary(newOldestMsgId, newNewestMsgId);
    // update boundary ids
    dispatch(
      upsertMessagesMetadata({
        vGroupID,
        oldestMsgId: newOldestMsgId,
        newestMsgId: newNewestMsgId,
        // message will be updated whenever it's marked as read, so the cache should always have up to date unread msgId
        oldestUnreadMsgId: cache.getFirstUnread()?.msgId,
      })
    );
    logger.info(
      'fetchMessage',
      `newOldestMsgId: ${newOldestMsgId}`,
      `newNewestMsgId: ${newNewestMsgId}`
    );
    // if target convo id is not the active one, we only need to update cache
    const activeConvoId = selectActiveConvoId(getState());
    if (activeConvoId !== vGroupID) {
      if (shouldClearTempMsg) dispatch(removeConvoMessage({ vGroupID, msgId: tempMsgId, reason }));
      logger.info('fetchMessage', `target convo id is not the active one`);
      return fetchedMessage;
    }

    // ***** Active convo *****
    const activeConvoMessages = selectActiveConvoMessages(getState());

    let upsertMessages: WickrMessage[] | undefined;
    if (activeConvoMessages.find((m) => m.msgId === msgId || m.msgId === tempMsgId)) {
      // the fetched message is part of active messages, or replacing an active temp message, update the message and two messages around it
      upsertMessages = messages;
      logger.info('fetchMessage', 'the fetched message is part of active messages');
    } else if (activeConvoMessages.find((m) => m.msgId === previousMessage?.msgId)) {
      // the fetched message is connected to any of active messages, append all new messages
      const newMessages = cache.getRange(previousMessage?.msgId, 0, 'infinite');
      // if active messages get deleted from cache, we upsert the new messages only
      upsertMessages = newMessages ? newMessages : messages;
      logger.info('fetchMessage', 'the fetched message is connected to active messages');
    } else {
      // the fetched message is not connected or part of active messages
      // which could be due to 4 potential scenarios:

      // 1. Message update: a message out of view get udpated
      //   - Add the new message to cache, which we've done that already
      // 2. New Conversation: this is a fresh convo with no prior messages
      //   - Add the message to active messages
      // 3. Unfetched: we haven't yet retrieved any messages from this convo
      //   - Same as 1
      // 4. Broken Chain: some messages are "missing" (in the case of sending messages too fast, certain messages do not appear in message update events) so we can't connect new messages
      //   - TODO: this needs to be fixed on Wickr side, but it's not easy to repro

      // To find scenario 2:
      //   when oldestMsgId is undefined, it indicates that we haven't attempted to fetch messages yet
      //   when oldestMsgId is an empty string, it suggests that the convo is new and has no message
      // then here's the logic we'll apply:
      if (currentOldestMsgId === '') {
        // in terms of concurrency, this update may occur multiple times before oldestMsgId is refreshed, but that's acceptable
        // our intent is to ensure that all incoming messages for a new convo are displayed
        upsertMessages = messages;
      }
      logger.info(
        'fetchMessage',
        'the fetched message is not connected or part of active messages'
      );
    }

    logger.info(
      'fetchMessage',
      'upsertMessages',
      upsertMessages?.map((m) => ({
        msgId: m.msgId,
        isRead: m.isRead,
        timeStamp: m.timeStamp,
      }))
    );

    // upsert the fetched message and two messages around it
    dispatch(
      upsertAndRemoveMessages({
        vGroupID: activeConvoId,
        reason,
        messages: upsertMessages,
        msgIdsToRemove: shouldClearTempMsg ? [tempMsgId] : undefined,
      })
    );

    if (fetchedMessage.textContent) {
      metricEvents.emit('TextMessageSendEnd', {
        content: fetchedMessage.textContent,
      });
    }

    return fetchedMessage;
  }
);

export const removeMessage = createAppAsyncThunk(
  `messages/removeMessage`,
  async (
    { vGroupID, msgId, reason }: GroupAndMsgId & { reason: MessagesUpdateReason },
    { dispatch, getState, extra }
  ) => {
    const cache = extra.messageCaches.getOrCreate(vGroupID);
    cache.delete(msgId);
    const boundaryIds = await extra.bridge.getBoundaryIds({ vgroupId: vGroupID });
    cache.updateBoundary(boundaryIds.oldestId, boundaryIds.newestId);
    dispatch(
      upsertMessagesMetadata({
        vGroupID,
        oldestMsgId: boundaryIds.oldestId,
        oldestUnreadMsgId: boundaryIds.oldestUnreadId,
        newestMsgId: boundaryIds.newestId,
        oldestUnreadMentionMsgId: boundaryIds.oldestUnreadMentionId,
        newestUnackErrorId: boundaryIds.newestUnackErrorId,
      })
    );
    dispatch(removeConvoMessage({ vGroupID, msgId, reason }));

    const isSearchPanelActive = selectIsActivePanel(getState(), 'SearchPanel');
    if (isSearchPanelActive) {
      dispatch(removeDeletedSearchItem(msgId));
    }
  }
);

export const fetchAndCachePaginatedMessages = createAppAsyncThunk(
  `messages/fetchAndCachePaginatedMessages `,
  async (payload: PaginatedMessagesPayload, { extra }) => {
    const cache = extra.messageCaches.getOrCreate(payload.vGroupID);
    const { messages } = await getPaginatedMessages(payload);
    cache.upsertMany(messages);
    return messages;
  }
);

export const fetchActiveConvoMessages = createAppAsyncThunk(
  `messages/fetchActiveConvoMessages`,
  async (payload: Omit<FetchMessagesPayload, 'vGroupID'>, { dispatch, getState, extra }) => {
    const vGroupID = selectActiveConvoId(getState());
    let requestMsgId: string | SpecialMsgId | undefined = payload.msgId;
    if (!vGroupID || !requestMsgId) {
      return;
    }
    logger.info('fetchActiveConvoMessages:', payload);
    let boundaryIds = selectActiveConvoBoundaryIds(getState());
    // it's possible requestMsgId is not a SpecialMsgId but we fetch messages from the convo for the first time, e.g. click on search result
    // so always fetch boundaryIds if boundaryIds is not cached
    if (!boundaryIds.newestId || !boundaryIds.oldestId) {
      logger.info('fetchActiveConvoMessages: boundaryIds cache miss');
      boundaryIds = await extra.bridge.getBoundaryIds({ vgroupId: vGroupID });
      logger.info('fetchActiveConvoMessages:', boundaryIds);
    }
    if (typeof requestMsgId !== 'string') {
      if (requestMsgId === SpecialMsgId.UNREAD) {
        // fallback to newestId if oldestUnreadId is empty
        requestMsgId = boundaryIds.oldestUnreadId || boundaryIds.newestId;
      } else if (requestMsgId === SpecialMsgId.NEWEST) {
        requestMsgId = boundaryIds.newestId;
      } else if (requestMsgId === SpecialMsgId.OLDEST) {
        requestMsgId = boundaryIds.oldestId;
      } else {
        logger.warn(
          'fetchActiveConvoMessages:',
          `unsupported msg id ${SpecialMsgId[requestMsgId]}`
        );
        requestMsgId = '';
      }
    }

    const upsertMetadata = () => {
      if (boundaryIds) {
        dispatch(
          upsertMessagesMetadata({
            vGroupID,
            oldestMsgId: boundaryIds.oldestId,
            oldestUnreadMsgId: boundaryIds.oldestUnreadId,
            newestMsgId: boundaryIds.newestId,
            oldestUnreadMentionMsgId: boundaryIds.oldestUnreadMentionId,
            newestUnackErrorId: boundaryIds.newestUnackErrorId,
          })
        );
      }
    };

    if (!requestMsgId) {
      // still update metadata
      upsertMetadata();
      return;
    }
    const cache = extra.messageCaches.getOrCreate(vGroupID);
    // this is not strictly required, but update boundary in cache will increase cache hit rate for some edge cases
    cache.updateBoundary(boundaryIds?.oldestId, boundaryIds?.newestId);
    let messages = cache.getRange(requestMsgId, payload.before, payload.after);

    metricEvents.emit('ConvoSwitchFetchMessages', {
      vgroupId: vGroupID,
      isCached: !!messages,
    });
    if (!messages) {
      // cache miss, fetch messages from SDK
      logger.info('fetchActiveConvoMessages: messages cache miss');
      messages = await dispatch(
        fetchAndCachePaginatedMessages({
          vGroupID,
          msgId: requestMsgId,
          before: payload.before,
          after: payload.after,
        })
      ).unwrap();
    }
    if (__DEV__) {
      logger.info(
        'fetchActiveConvoMessages:',
        messages.map((m) => ({
          msgId: m.msgId,
          isRead: m.isRead,
          timeStamp: m.timeStamp,
        }))
      );
    }
    dispatch(
      upsertMessagesMetadata({
        vGroupID,
        oldestMsgId: boundaryIds?.oldestId,
        oldestUnreadMsgId: boundaryIds?.oldestUnreadId,
        newestMsgId: boundaryIds?.newestId,
        oldestUnreadMentionMsgId: boundaryIds?.oldestUnreadMentionId,
        newestUnackErrorId: boundaryIds?.newestUnackErrorId,
      })
    );
    dispatch(upsertConvoMessages({ vGroupID, messages, reason: payload.reason }));
    return messages;
  }
);

export const upsertAndRemoveMessages = createAppAsyncThunk(
  `messages/upsertAndRemoveMessages`,
  async (
    {
      vGroupID,
      reason,
      messages,
      msgIdsToRemove,
    }: {
      vGroupID: string;
      reason: MessagesUpdateReason;
      messages?: WickrMessage[];
      msgIdsToRemove?: string[];
    },
    { dispatch }
  ) => {
    if (messages && messages.length) {
      dispatch(upsertConvoMessages({ vGroupID, messages, reason }));
    }
    if (msgIdsToRemove && msgIdsToRemove.length) {
      dispatch(removeManyConvoMessages({ vGroupID, ids: msgIdsToRemove, reason }));
    }
  }
);

export const removeActiveConvoMessagesByCount = createAppAsyncThunk(
  `messages/removeActiveConvoMessagesByCount`,
  async (payload: Omit<RemoveMessagesActionPayload, 'vGroupID'>, { dispatch, getState }) => {
    const vGroupID = selectActiveConvoId(getState());
    dispatch(removeConvoMessagesByCount({ vGroupID, ...payload }));
  }
);

const fetchUserQueue = new Set<string>();

export const fetchUser = createAppAsyncThunk(
  `messages/fetchUser`,
  async (idHash: string, { dispatch }) => {
    // de-dupe fetch user id requests
    if (fetchUserQueue.has(idHash)) return false;

    fetchUserQueue.add(idHash);

    try {
      const user = await getUser(idHash);
      if (user) {
        dispatch(upsertUsers([user]));
      }
      return user;
    } finally {
      fetchUserQueue.delete(idHash);
    }
  }
);

export const fetchUserById = createAppAsyncThunk(
  `messages/fetchUserById`,
  async (id: string, { dispatch }) => {
    // de-dupe fetch user id requests
    if (fetchUserQueue.has(id)) return false;

    fetchUserQueue.add(id);
    const user = await getUserById(id);
    if (user) {
      dispatch(upsertUsers([user]));
    }
    fetchUserQueue.delete(id);
    return user;
  }
);

export const markMessageRead = createAppAsyncThunk(
  `messages/markMessageRead`,
  async (payload: MarkMessageReadPayload, { extra }) => {
    logger.info('markMessageRead:', payload);
    return extra.bridge.markMessageRead(payload);
  }
);

export const sendTextMessage = createAppAsyncThunk(
  `messages/sendTextMessage`,
  async (payload: SendTextMessagePayload, { dispatch, extra, getState }) => {
    const hasUnauthorizedMembers = selectActiveConvoHasUnauthorizedMembers(getState());
    if (hasUnauthorizedMembers) return;
    logger.info('sendTextMessage:', redactInProd(payload));
    if (payload.edit) {
      dispatch(
        setMessagePendingEdit({
          vGroupID: payload.vgroupId,
          msgId: payload.edit,
          messageContent: payload.message,
        })
      );
    }
    if (payload.message) metricEvents.emit('TextMessageSendStart', { content: payload.message });
    return extra.bridge.sendTextMessage(payload);
  }
);

export const resendMessage = createAppAsyncThunk(
  `messages/resendMessage`,
  async (payload: ResendMessagePayload, { extra }) => {
    return extra.bridge.resendMessage(payload);
  }
);

export const sendVoiceMessage = createAppAsyncThunk(
  `messages/sendVoiceMessage`,
  async (payload: SendVoiceMemoPayload, { extra, getState }) => {
    const hasUnauthorizedMembers = selectActiveConvoHasUnauthorizedMembers(getState());
    if (hasUnauthorizedMembers) return;
    logger.info('sendVoiceMessage:', payload.recordingLength, 'ms');
    return extra.bridge.sendVoiceMemo(payload);
  }
);

export const sendTypingActivity = createAppAsyncThunk(
  `messages/sendTypingActivity`,
  async (payload: SendTypingActivityPayload, { extra }) => {
    logger.info('sendTypingActivity:', payload);
    return extra.bridge.sendTypingActivity(payload);
  }
);

export const shareLocation = createAppAsyncThunk(
  `messages/shareLocation`,
  async (_: undefined, { extra, getState }) => {
    const hasUnauthorizedMembers = selectActiveConvoHasUnauthorizedMembers(getState());
    if (hasUnauthorizedMembers) return;
    logger.info('shareLocation');
    return extra.uiBridge.shareLocation();
  }
);

export const uploadFile = createAppAsyncThunk(
  `messages/uploadFile`,
  async (_: undefined, { extra, getState }) => {
    const hasUnauthorizedMembers = selectActiveConvoHasUnauthorizedMembers(getState());
    if (hasUnauthorizedMembers) return;
    logger.info('uploadFile');
    return extra.uiBridge.uploadFile();
  }
);

export const joinCall = createAppAsyncThunk(
  `messages/joinCall`,
  async (payload: JoinCallPayload, { extra, getState }) => {
    const hasUnauthorizedMembers = selectActiveConvoHasUnauthorizedMembers(getState());
    if (hasUnauthorizedMembers) return;
    logger.info('joinCall', payload);
    return extra.uiBridge.joinCall(payload);
  }
);

export const starMessage = createAppAsyncThunk(
  `messages/starMessage`,
  async (payload: StarMessagePayload, { dispatch, extra, getState }) => {
    const hasUnauthorizedMembers = selectActiveConvoHasUnauthorizedMembers(getState());
    if (hasUnauthorizedMembers) return;
    logger.info('starMessage', payload);
    dispatch(starConvoMessage(payload));
    try {
      await extra.bridge.starMessage(payload);
    } catch (err) {
      dispatch(starConvoMessage({ ...payload, star: !payload.star }));
    }
  }
);

export const createDM = createAppAsyncThunk(
  `messages/createDM`,
  async (payload: CreateDMPayload, { extra, getState, dispatch }) => {
    const directoryUser = selectDirectoryUserByIdHash(getState(), payload.userHash);

    if (directoryUser?.isDirectoryUser) {
      // Convert directory user to contact before creating DM
      await dispatch(convertDirectoryUserToContact(payload));
    }

    const targetConvoId = await extra.bridge.getVgroupIdFromHash({
      otherUserHash: payload.userHash,
    });
    if (targetConvoId) {
      dispatch(
        setDraftMessage({
          message: {
            content: markdownToJSON(payload.message),
          },
          vGroupId: targetConvoId,
        })
      );
    }
    logger.info('createDM', redactInProd(payload));
    return extra.bridge.createDM(payload);
  }
);

export const createGroup = createAppAsyncThunk(
  `messages/createGroup`,
  async (payload: CreateGroupPayload, { extra }) => {
    logger.info('createGroup', payload);
    return extra.bridge.createGroup(payload);
  }
);

export const createRoom = createAppAsyncThunk(
  `messages/createRoom`,
  async (payload: CreateRoomPayload, { extra }) => {
    logger.info('createRoom', redactInProd(payload));
    return extra.bridge.createRoom(payload);
  }
);

export const emojiReact = createAppAsyncThunk(
  `messages/emojiReact`,
  async (
    { vgroupId, messageId, emoji }: Omit<EmojiReactMessagePayload, 'removed'>,
    { getState }
  ) => {
    const hasUnauthorizedMembers = selectActiveConvoHasUnauthorizedMembers(getState());
    if (hasUnauthorizedMembers) return false;
    logger.info('emojiReact', vgroupId, messageId);
    const msg = selectConvoMessage(getState(), vgroupId, messageId);
    const myId = selectSelfUserIdHash(getState());
    if (!msg) return false;
    const { reactions } = msg;
    const reaction = reactions?.find((r) => r.identifier === emoji);
    const remove = !!reaction?.userIDs?.includes(myId);

    const result = await reactToMessage(vgroupId, messageId, emoji, remove);

    return !!result?.status;
  }
);

export const deleteMessage = createAppAsyncThunk(
  `messages/deleteMessage`,
  async (payload: DeleteMessagePayload, { extra, getState }) => {
    const hasUnauthorizedMembers = selectActiveConvoHasUnauthorizedMembers(getState());
    if (hasUnauthorizedMembers) return;
    logger.info('deleteMessage', payload);
    return extra.bridge.deleteMessage(payload);
  }
);

export const pasteImage = createAppAsyncThunk(
  `messages/pasteImage`,
  async (_: undefined, { extra, getState }) => {
    const hasUnauthorizedMembers = selectActiveConvoHasUnauthorizedMembers(getState());
    if (hasUnauthorizedMembers) return;
    logger.info('pasteImage');
    if (await extra.uiBridge.clipboardHasImage()) {
      logger.info('pasteImage::clipboard has image, pasting image');
      return extra.uiBridge.pasteImage();
    }
    return false;
  }
);

const FETCH_CONVO_BOUNDARY_IDS_DELAY_MS = 200;
const convoFetchBoundaryMap = new Map<string, DebouncedFunc<() => void>>();

export const throttledFetchConvoBoundaryIds = createAppAsyncThunk(
  `messages/throttledFetchConvoBoundaryIds`,
  async (vGroupID: string, { dispatch }) => {
    let fetchConvo = convoFetchBoundaryMap.get(vGroupID);
    if (!fetchConvo) {
      fetchConvo = throttle(
        () => {
          dispatch(fetchConvoBoundaryIds(vGroupID));
        },
        FETCH_CONVO_BOUNDARY_IDS_DELAY_MS,
        { leading: true, trailing: true }
      );
      convoFetchBoundaryMap.set(vGroupID, fetchConvo);
    }
    fetchConvo();
  }
);

export const fetchConvoBoundaryIds = createAppAsyncThunk(
  `messages/fetchConvoBoundaryIds`,
  async (vGroupID: string, { dispatch, extra }) => {
    const boundaryIds = await extra.bridge.getBoundaryIds({ vgroupId: vGroupID });
    const cache = extra.messageCaches.getOrCreate(vGroupID);
    cache.updateBoundary(boundaryIds.oldestId, boundaryIds.newestId);
    dispatch(
      upsertMessagesMetadata({
        vGroupID,
        oldestMsgId: boundaryIds.oldestId,
        oldestUnreadMsgId: boundaryIds.oldestUnreadId,
        newestMsgId: boundaryIds.newestId,
        oldestUnreadMentionMsgId: boundaryIds?.oldestUnreadMentionId,
        newestUnackErrorId: boundaryIds?.newestUnackErrorId,
      })
    );
    return boundaryIds;
  }
);

export const getOpenFileAllowList = createAppAsyncThunk(
  `messages/getOpenFileAllowList`,
  async (_: undefined, { extra }) => {
    logger.info('getOpenFileAllowList');
    return extra.bridge.getOpenFileAllowList();
  }
);

export const ackMessageSendFailure = createAppAsyncThunk(
  `messages/ackMessageSendFailure`,
  async (payload: AckMessageSendFailurePayload, { extra }) => {
    logger.info('ackMessageSendFailure', payload);
    return extra.bridge.ackMessageSendFailure(payload);
  }
);

export const clearBotWarning = createAppAsyncThunk(
  `messages/clearBotWarning`,
  async (payload: ClearBotWarningPayload, { dispatch, extra }) => {
    logger.info('clearBotWarning', payload);
    // Update store to clear warning instantly
    dispatch(clearConvoBotWarning(payload));
    return extra.bridge.clearBotWarning(payload);
  }
);

export const reportError = createAppAsyncThunk(
  `messages/reportError`,
  async (payload: ReportErrorPayload, { extra }) => {
    logger.info('reportError', payload);
    // Report error of messages that fail to send
    return extra.bridge.reportError(payload);
  }
);

export const forwardMessage = createAppAsyncThunk(
  `messages/forwardMessage`,
  async (payload: ForwardMessagePayload, { extra, getState }) => {
    const hasUnauthorizedMembers = selectActiveConvoHasUnauthorizedMembers(getState());
    if (hasUnauthorizedMembers) return;
    extra.bridge.forwardMessage(payload);
  }
);
