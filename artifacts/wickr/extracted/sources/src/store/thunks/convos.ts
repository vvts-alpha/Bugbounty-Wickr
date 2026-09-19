import { AppDispatch } from '..';
import {
  removeConvos,
  setActiveConvoHasUnverifiedMembers,
  upsertConvos,
  selectConvo,
  selectConvoRealMemberEmails,
  selectConvoRealMemberNames,
  setConvoWebAppLoaded,
  setConvoSilenced,
} from '../slices/convos';
import { pushPanel } from '../slices/panels';
import { selectActiveConvoId } from '../slices/shared';
import { selectActiveChatView, setActiveChatView, setActiveConvoId } from '../slices/uiChat';
import { upsertUsers } from '../slices/users';
import { createAppAsyncThunk } from '../utils';
import {
  ConfigureWebAppPayload,
  EditConvoPayload,
  MarkConvoAsUnreadPayload,
  MlsActionPayload,
  RemoveWebAppPayload,
  SendLocationMessagePayload,
  SendTypingActivityPayload,
  SetActiveConvoPayload,
  UpdateNotificationPreferencesPayload,
  WebAppLoadUrlPayload,
} from '@/apis/webChannel/BridgeWebChannel';
import { JoinCallPayload } from '@/apis/webChannel/UIBridgeWebChannel';
import { getConvoAndUsers, getConvoListItems } from '@/apis/webFetch';
import { generateChatRoute } from '@/chat/routes';
import { Logger } from '@/lib/logger';
import { WickrConvoListItem, convoListItemToWickrConvo } from '@/lib/protobuf/convos';
import { bufferThunkUntil, throttle } from '@/utils/function';
import { copyTextToClipboard } from '@/utils/strings';
import { fetchAndCachePaginatedMessages, fetchConvoBoundaryIds } from './messages';

const logger = new Logger('store/convo');

export const fetchActiveConvo = createAppAsyncThunk(
  `convos/fetchActiveConvo`,
  (_, { dispatch, getState }) => {
    const vGroupID = selectActiveConvoId(getState());
    return dispatch(fetchConvo(vGroupID));
  }
);

/**
 * Fetch full convo info, used for active convo status update (members, convo description, etc)
 */
export const fetchConvo = createAppAsyncThunk(
  `convos/fetchConvo`,
  async (vGroupID: string, { dispatch }) => {
    if (vGroupID) {
      const { convo, users } = await getConvoAndUsers(vGroupID);
      dispatch(upsertConvos([convo]));
      dispatch(upsertUsers(users));
      dispatch(updateConvoDetails(vGroupID));
    }
  }
);
export const removeConvo = createAppAsyncThunk(
  `convos/removeConvo`,
  async (vGroupID: string, { dispatch, getState, extra }) => {
    const activeConvoId = selectActiveConvoId(getState());
    if (vGroupID) {
      extra.messageCaches.delete(vGroupID);
      dispatch(removeConvos([vGroupID]));
      if (vGroupID === activeConvoId) {
        dispatch(setActiveConvoId(''));
      }
    }
  }
);

/**
 * Fetch limited convo info, used for side bar convo status update (typing indicator, unread count, etc)
 */
export const fetchConvoListItems = createAppAsyncThunk(
  `convos/fetchConvoListItems`,
  bufferThunkUntil<string | undefined>( // batch calls to this thunk and process them all together after a delay
    async (vgroupIds, { dispatch }) => {
      logger.info('fetchConvoListItems', `fetch ${vgroupIds.length} items`);
      // process each vgroupId in batched parameters to fetch convo list items
      let convoInfo: WickrConvoListItem[] | (WickrConvoListItem[] | undefined)[] = [];

      if (vgroupIds.length < 10 && vgroupIds.every((id) => !!id)) {
        // fetch < 10 items and there's no fetchAll request, fetch each one individually
        convoInfo = await Promise.all(
          vgroupIds.map(async (vgroupId) => {
            try {
              return await getConvoListItems(vgroupId);
            } catch (error) {
              logger.error('fetchConvoListItems', `fetch ${vgroupId} failed`, error);
            }
          })
        );
      } else {
        logger.info(
          'fetchConvoListItems',
          `fetch 10+ items or there's fetchAll request, fetch all instead`
        );
        try {
          convoInfo = await getConvoListItems();
        } catch (error) {
          logger.error('fetchConvoListItems', `fetch all failed`, error);
        }
      }

      // convert them to PartialWickrConvo[]
      const convos = convoInfo
        .flat()
        .filter((convo): convo is WickrConvoListItem => Boolean(convo?.vgroupId))
        .map(convoListItemToWickrConvo);
      // upsert all at once for better performance
      if (convos.length) {
        logger.info('fetchConvoListItems', `dispatch ${convos.length} items`);
        dispatch(upsertConvos(convos));
      }
    },
    500,
    { leading: true } // set leading to true, process first call immediately for better UI responsiveness
  )
);

export const fetchAllConvoListItems = createAppAsyncThunk(
  `convos/fetchAllConvoListItems`,
  async (_: never, { dispatch }) => {
    // blank string returns all conversations
    return dispatch(fetchConvoListItems());
  }
);

export const joinCall = createAppAsyncThunk(
  `convos/joinCall`,
  async (payload: JoinCallPayload, { extra }) => {
    logger.info('joinCall', payload);
    return extra.uiBridge.joinCall(payload);
  }
);

const TYPING_ACTIVITY_REPORT_RATE_MS = 1000;

const sendTypingActivity = createAppAsyncThunk(
  `convos/sendTypingActivity`,
  async (payload: SendTypingActivityPayload, { extra }) => {
    logger.info('sendTypingActivity:', payload);
    return extra.bridge.sendTypingActivity(payload);
  }
);

export const dispatchThrottledSendTypingActivity = throttle(
  (dispatch: AppDispatch, payload: SendTypingActivityPayload) => {
    dispatch(sendTypingActivity(payload));
  },
  TYPING_ACTIVITY_REPORT_RATE_MS,
  { leading: true, trailing: false }
);

export const viewRoomDetails = createAppAsyncThunk(
  `convos/viewRoomDetails`,
  async (_: undefined, { dispatch }) => {
    logger.info('viewRoomDetails');
    dispatch(
      pushPanel({
        name: 'ConvoDetailsPanel',
      })
    );
  }
);

export const openSavedItems = createAppAsyncThunk(
  `convos/openSavedItems`,
  async (_: undefined, { dispatch }) => {
    logger.info('openSavedItems');
    dispatch(pushPanel({ name: 'SavedLinksPanel' }));
  }
);

export const addMods = createAppAsyncThunk(`convos/addMods`, async (_: undefined, { extra }) => {
  logger.info('addMods');
  return extra.uiBridge.addMods();
});

export const manageUsers = createAppAsyncThunk(
  `convos/manageUsers`,
  async (_: undefined, { extra }) => {
    logger.info('manageUsers');
    return extra.uiBridge.manageUsers();
  }
);

/** Handles changes to a conversation and its properties */
export const handleConvoUpdated = createAppAsyncThunk(
  `convos/handleConvoUpdated`,
  async (vgroupId: string, { dispatch, getState }) => {
    logger.debug('handleConvoUpdated', vgroupId);
    const activeConvoId = selectActiveConvoId(getState());
    if (activeConvoId === vgroupId) {
      dispatch(fetchConvo(vgroupId));
    }
    dispatch(fetchConvoListItems(vgroupId));
    dispatch(updateConvoDetails(vgroupId));
  }
);

/** Updates convo details of a convo (eg. unverified members) */
export const updateConvoDetails = createAppAsyncThunk(
  `convos/updateConvoDetails`,
  async (vgroupId: string, { dispatch, getState, extra }) => {
    const activeConvoId = selectActiveConvoId(getState());
    const convoDetails = await extra.bridge.getConversationDetails({ vgroupId });

    if (vgroupId === activeConvoId) {
      dispatch(
        setActiveConvoHasUnverifiedMembers({
          vgroupId,
          activeConvoHasUnverifiedMembers: convoDetails.unverifiedUsers || false,
        })
      );
    }
  }
);

export const processConvoAdded = createAppAsyncThunk(
  `convos/processConvoAdded`,
  async (vgroupId: string, { dispatch, getState }) => {
    const activeConvoId = selectActiveConvoId(getState());

    if (activeConvoId === vgroupId) {
      dispatch(fetchConvo(vgroupId));
    } else {
      // No need to fetch entire convo if it's not active convo, fetchConvoListItems will get only the info that side bar list item needs
      dispatch(fetchConvoListItems(vgroupId));
    }
  }
);

/** Handles switching the active conversation */
export const handleActiveConvoSwitched = createAppAsyncThunk(
  `convos/handleActiveConvoSwitched`,
  async (vgroupId: string, { dispatch, getState, extra }) => {
    // vgroupId is an empty string when Wickr navigates to the root
    if (vgroupId) {
      dispatch(setActiveChatView('messages'));
      extra.navigate(generateChatRoute.convo(vgroupId));
    } else {
      const activeView = selectActiveChatView(getState());
      if (activeView === 'messages') {
        extra.navigate(generateChatRoute.landing());
      }
    }
  }
);

export const deleteConvo = createAppAsyncThunk(
  `convos/deleteConvo`,
  async (vgroupId: string, { extra }) => {
    logger.info('deleteConvo', vgroupId);
    return extra.bridge.deleteConvo({ vgroupId });
  }
);

export const pinConvo = createAppAsyncThunk(
  `convos/pinConvo`,
  async (vgroupId: string, { extra }) => {
    logger.info('pinConvo', vgroupId);
    return extra.bridge.pinConvo({ vgroupId });
  }
);

export const unpinConvo = createAppAsyncThunk(
  `convos/unpinConvo`,
  async (vgroupId: string, { extra }) => {
    logger.info('unpinConvo', vgroupId);
    return extra.bridge.unpinConvo({ vgroupId });
  }
);

export const leaveConvo = createAppAsyncThunk(
  `convos/leaveConvo`,
  async (vgroupId: string, { extra }) => {
    logger.info('leaveConvo', vgroupId);
    return extra.bridge.leaveConvo({ vgroupId });
  }
);

/**
 * This updates the active convo on the QT side when we switch convos on the web side. This is necessary
 * because a there are a bunch of things that can get out of sync if QT still thinks we're in a different
 * convo. It is not called as a side effect of navigation because QT can force the web app to navigate,
 * which would then cause the web side to call `setActiveConvo` again on QT.
 * @deprecated Because you should only call this is you really need it
 */
export const setActiveConvoInQt = createAppAsyncThunk(
  `convos/setActiveConvoInQt`,
  async (payload: SetActiveConvoPayload, { extra }) => {
    logger.info('setActiveConvo', payload);
    return extra.bridge.setActiveConvo(payload);
  }
);

export const clearAllUnreadConvos = createAppAsyncThunk(
  `convos/clearAllUnreadConvos`,
  async (_: undefined, { extra }) => {
    logger.debug('clearAllUnreadConvos');
    return extra.bridge.clearAllUnreadConvos();
  }
);

export const markConvoAsUnread = createAppAsyncThunk(
  `convos/markConvoAsUnread`,
  async (payload: MarkConvoAsUnreadPayload, { extra }) => {
    logger.info('markConvoAsUnread', payload);
    return extra.bridge.markConvoAsUnread(payload);
  }
);

/**
 * Edit convo properties, such as title, description, burn on read,
 * members, moderators, and more.
 * @param payload.destructionTime Should be in milliseconds
 * @param payload.burnOnRead Should be in milliseconds
 * @returns True if it was successfully edited, and false if the user
 * was unable to edit it.
 */
export const editConvo = createAppAsyncThunk(
  `convos/editConvo`,
  async (payload: EditConvoPayload, { extra }) => {
    const changedKeys = Object.keys(payload).filter((k) => k !== 'vgroupId');
    if (changedKeys.length === 0) {
      logger.info(`editConvo no-op due to no edits (0 changed keys)`);
      return;
    }

    // Log changed keys, but not values (since values are PII)
    logger.info(`editConvo ${payload.vgroupId} changed: ${changedKeys.join(', ')}`);
    return extra.bridge.editConvo(payload);
  }
);

/**
 * Fetch messages around the oldestUnreadId and cache them
 * @returns The number of messages added to cache
 */
export const cacheConvoAroundUnreadMessages = createAppAsyncThunk(
  `convos/cacheConvoAroundUnreadMessages`,
  async (
    { vgroupId, before = 10, after = 15 }: { vgroupId: string; before?: number; after?: number },
    { dispatch, getState }
  ): Promise<number> => {
    const convo = selectConvo(getState(), vgroupId);

    if (convo) {
      let oldestUnreadId = convo.oldestUnreadMsgId;
      if (!oldestUnreadId) {
        const boundary = await dispatch(fetchConvoBoundaryIds(convo.vGroupID)).unwrap();
        oldestUnreadId = boundary.oldestUnreadId;
      }
      if (oldestUnreadId) {
        const messages = await dispatch(
          fetchAndCachePaginatedMessages({
            vGroupID: convo.vGroupID,
            msgId: oldestUnreadId,
            before,
            after,
          })
        ).unwrap();
        return messages.length;
      }
    }

    return 0;
  }
);

export const sendLocationMessage = createAppAsyncThunk(
  `convos/sendLocationMessage`,
  async (payload: SendLocationMessagePayload, { extra }) => {
    logger.info('sendLocationMessage');
    return extra.bridge.sendLocationMessage(payload);
  }
);

export const copyConvoMemberNamesToClipboard = createAppAsyncThunk(
  `convos/copyConvoMemberNamesToClipboard`,
  async (vgroupId: string, { getState }) => {
    if (!vgroupId) return false;

    const names = selectConvoRealMemberNames(getState(), vgroupId);

    if (names.length) {
      copyTextToClipboard(names.join('\n'));
      return true;
    }
    return false;
  }
);

export const copyConvoMemberEmailsToClipboard = createAppAsyncThunk(
  `convos/copyConvoMemberEmailsToClipboard`,
  async (vgroupId: string, { getState }) => {
    if (!vgroupId) return false;

    const emails = selectConvoRealMemberEmails(getState(), vgroupId);

    if (emails.length) {
      // new lines tested in Outlook and Gmail
      copyTextToClipboard(emails.join('\n'));
      return true;
    }
    return false;
  }
);

export const updateConvoNotificationPreferences = createAppAsyncThunk(
  `convos/updateConvoNotificationPreferences`,
  async (
    payload: UpdateNotificationPreferencesPayload & { silenced?: boolean },
    { extra, dispatch, getState }
  ) => {
    logger.info('updateConvoNotificationPreferences');

    // Handle silenced state (Labs feature - Web only)
    // Sync both Redux state and storage
    const silencedValue = payload.isMuted ? !!payload.silenced : false;
    dispatch(setConvoSilenced({ vgroupId: payload.vgroupId, silenced: silencedValue }));

    // Convert object to array of IDs for storage
    const silencedConvos = getState().convos.silencedConvos;
    const silencedIds = Object.keys(silencedConvos).filter((id) => silencedConvos[id]);
    extra.storage.set('SilencedConvos', silencedIds).catch((error) => {
      logger.error('Failed to save silenced convos to storage', error);
    });

    return extra.bridge.manageNotifications(payload);
  }
);

export const mlsAction = createAppAsyncThunk(
  `convos/mslAction`,
  async (payload: MlsActionPayload, { extra }) => {
    logger.info('mlsAction', payload);
    return extra.bridge.mlsAction(payload);
  }
);

export const configureWebApp = createAppAsyncThunk(
  `settings/configureWebApp`,
  async (payload: ConfigureWebAppPayload, { extra }) => {
    return extra.bridge.configureWebApp(payload);
  }
);

export const webAppLoadUrl = createAppAsyncThunk(
  `settings/webAppLoadUrl`,
  async (payload: WebAppLoadUrlPayload, { extra }) => {
    return extra.bridge.webAppLoadUrl(payload);
  }
);

export const removeWebApp = createAppAsyncThunk(
  `settings/removeWebApp`,
  async (payload: RemoveWebAppPayload, { extra, dispatch }) => {
    dispatch(setConvoWebAppLoaded({ vgroupId: payload.id, loaded: false }));
    return extra.bridge.removeWebApp(payload);
  }
);
