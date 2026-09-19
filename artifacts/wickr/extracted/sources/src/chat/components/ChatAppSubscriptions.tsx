import { useEffect } from 'react';
import { useWebChannel } from '@/apis/webChannel/context';
import { getPaginatedMessages } from '@/apis/webFetch';
import { CompositeAuthService } from '@/lib/awsAuth/CompositeAuthService';
import { devErrorTracker } from '@/lib/devErrors';
import { Logger } from '@/lib/logger';
import {
  GroupAndMsgAndTempMsgId,
  hasGroupAndMsgId,
  WickrMessageCollection,
} from '@/lib/protobuf/messages';
import { useAppDispatch, useAppStore } from '@/store';
import { setQuickResponses } from '@/store/slices/account';
import { selectActiveConvoId } from '@/store/slices/shared';
import { setActiveTypingActivities, setUnreadMessagesCount } from '@/store/slices/uiChat';
import {
  handleActiveConvoSwitched,
  handleConvoUpdated,
  processConvoAdded,
  removeConvo,
} from '@/store/thunks/convos';
import { fetchSavedLinks, handleFileManagerContentsChanged } from '@/store/thunks/files';
import { removeMessage, upsertMessage } from '@/store/thunks/messages';
import { fetchRoomHistoryListItems } from '@/store/thunks/roomHistory';
import { handleSearchResultClicked } from '@/store/thunks/roomSearch';
import { bufferUntil } from '@/utils/function';
import { getHash, redactInProd } from '@/utils/strings';

const logger = new Logger('ChatAppSubscriptions');

// Subscribes to signals/properties and connects the handlers
// For the chat app (not for signin)
export const ChatAppSubscriptions = () => {
  const dispatch = useAppDispatch();
  const store = useAppStore();
  const { bridge, fileManager, uiBridge } = useWebChannel();

  useEffect(() => {
    const getActiveConvoId = () => selectActiveConvoId(store.getState());

    // ===========================================
    // Connect signals to handlers
    // ===========================================

    /** Called when switching between convos, not when convo data changes */
    const handleActiveConvoChanged = (vgroupId: string) => {
      // This signal is usually comes in _after_ we have already switched conversations,
      // but we still dispatch the change for the few cases where it comes from the SDK, e.g., createDM.
      // We have an useAppSelector+useEffect handler to dispatch the convo changed thunk.
      dispatch(handleActiveConvoSwitched(vgroupId));
    };

    bridge.getActiveConvoInfo().then(
      (info) => {
        if (info.vgroupId) {
          handleActiveConvoChanged(info.vgroupId);
        }
      },
      (reason) => {
        devErrorTracker.addError(new Error('Failed to get active convo info', { cause: reason }));
      }
    );

    bridge.getMessageUnreadCount().then(
      (counts) => {
        dispatch(setUnreadMessagesCount(counts));
      },
      (reason) => {
        devErrorTracker.addError(
          new Error('Failed to get message unread count', { cause: reason })
        );
      }
    );

    const handleMessageUpsert = bufferUntil<[string, string, string]>(
      async (messageInfo) => {
        logger.info(`handleMessageUpsert: ${messageInfo.length} messages added or updated`);
        const messageRequests: {
          vGroupID: string;
          tempMsgId?: string;
          msgId: string;
          collection: WickrMessageCollection;
        }[] = [];
        // fetch all requested messages
        for (const info of messageInfo) {
          const [vGroupID, tempMessageId, messageId] = info;
          const msgId = messageId || tempMessageId;
          const payload: GroupAndMsgAndTempMsgId = {
            vGroupID,
            msgId,
            tempMsgId: tempMessageId,
          };
          if (hasGroupAndMsgId(payload)) {
            try {
              const collection = await getPaginatedMessages({
                vGroupID,
                msgId,
                before: 1,
                after: 1,
              });
              messageRequests.push({
                vGroupID,
                tempMsgId: payload.tempMsgId,
                msgId,
                collection,
              });
            } catch (error) {
              logger.error(`handleMessageUpsert: Failed to fetch message ${msgId} in ${vGroupID}`);
            }
          }
        }
        // group message requests by vGroupID
        const messageRequestsByVGroupID = messageRequests.reduce((accumulator, current) => {
          if (!accumulator[current.vGroupID]) {
            accumulator[current.vGroupID] = [];
          }
          accumulator[current.vGroupID].push(current);
          return accumulator;
        }, {} as Record<string, typeof messageRequests>);
        // upsert all groups asynchronously, but for each vGroupID, upsert messages "synchronously"
        const upsertPromises: Promise<void>[] = [];
        for (const [_, requests] of Object.entries(messageRequestsByVGroupID)) {
          upsertPromises.push(
            (async () => {
              for (const { vGroupID, tempMsgId, msgId, collection } of requests) {
                await dispatch(
                  upsertMessage({
                    vGroupID,
                    msgId,
                    tempMsgId,
                    messageCollection: collection,
                    reason: 'newMessage',
                  })
                ).unwrap();
              }
            })()
          );
        }
        await Promise.all(upsertPromises);
      },
      50,
      {
        leading: true,
      }
    );

    const unsubs: Array<() => void> = [
      bridge.connect('activeConvoChanged', handleActiveConvoChanged),

      bridge.connect('convoDeleted', (vgroupId) => {
        logger.info('convoDeleted', vgroupId);
        dispatch(removeConvo(vgroupId));
      }),

      bridge.connect('messageAdded', handleMessageUpsert),

      bridge.connect('messageChanged', handleMessageUpsert),

      bridge.connect('messageRemoved', (vGroupID, tempMessageId, messageId) => {
        const msgId = messageId || tempMessageId;
        logger.info('handleMessageDelete', msgId);
        dispatch(removeMessage({ vGroupID, msgId, reason: 'deleteMessage' }));
      }),

      bridge.connectProperty('quickResponsesChanged', async () => {
        const quickResponses = (await bridge.getQuickResponses()) ?? [];
        // quickResponses can have PII, only log length in prod
        logger.debug('quickResponsesChanged', redactInProd(quickResponses, quickResponses.length));
        dispatch(setQuickResponses(quickResponses));
      }),

      bridge.connect('typingActivityChanged', (typingActivities, vgroupId) => {
        logger.debug(
          'typingActivityChanged',
          vgroupId,
          `[${typingActivities.flatMap((a) => `[${getHash(a.name, 4)}, ${a.activity}]`).join(',')}]`
        );
        dispatch(setActiveTypingActivities({ typingActivities, vgroupId }));
      }),

      bridge.connect('roomHistoryChanged', (convoId) => {
        dispatch(fetchRoomHistoryListItems(convoId));
      }),

      bridge.connect('messageUnreadCountChanged', (payload) => {
        dispatch(setUnreadMessagesCount(payload));
      }),

      bridge.connect('bedrockDeeplinkTriggered', async (url) => {
        const authService = CompositeAuthService.getInstance();
        await authService.handleAuthCallback(url);
      }),

      fileManager.connect('fileManagerContentsChanged', (vgroupId) => {
        logger.info('onFileManagerContentsChanged', vgroupId);
        dispatch(handleFileManagerContentsChanged(vgroupId));
      }),

      uiBridge.connect('searchResultClicked', (vGroupID, msgId) =>
        dispatch(handleSearchResultClicked({ vGroupID, msgId }))
      ),

      bridge.connect('convoAdded', (vgroupId) => {
        const activeConvoId = getActiveConvoId();
        logger.debug('convoAdded', { vgroupId, activeConvoId });
        dispatch(processConvoAdded(vgroupId));
      }),

      bridge.connect('convoChanged', (vgroupId) => {
        const activeConvoId = getActiveConvoId();
        logger.debug('convoChanged', { vgroupId, activeConvoId });
        dispatch(handleConvoUpdated(vgroupId));
      }),

      fileManager.connect('linkImageAdded', (payload) => {
        logger.info('onLinkImageAdded', payload);
        const activeConvoId = getActiveConvoId();
        dispatch(fetchSavedLinks({ vgroupId: activeConvoId }));
      }),
    ];

    return () => unsubs.forEach((unsub) => unsub());
  }, [bridge, fileManager, uiBridge, dispatch, store]);

  return null;
};
