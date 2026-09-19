import { ConvoCollection } from '@amzn/wickr-messaging-protocol-proto';
import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { createResetSliceReducer, resetSlice } from '../shared';
import { ClearBotWarningPayload, StarMessagePayload } from '@/apis/webChannel/BridgeWebChannel';
import { Logger } from '@/lib/logger';
import { WickrConvoMember } from '@/lib/protobuf/contacts';
import { ConvoNotificationPreferences, PartialWickrConvo, WickrConvo } from '@/lib/protobuf/convos';
import { WickrOutboxStatus } from '@/lib/protobuf/messages';
import { redactInProd } from '@/utils/strings';
import {
  ConvoMetadata,
  SetActiveConvoHasUnverifiedMembersPayload,
  ConvoEntity,
  ConvosState,
} from './convosModels';
import { messagesAdapter, MessagesPayloadAction, MessagesUpdateReason } from './messagesAdapter';

const logger = new Logger('convosSlice');

export type MembersActionPayload = {
  vGroupID: string;
  members: WickrConvoMember[];
};

export type UpsertMemberActionPayload = {
  vGroupID: string;
  member: WickrConvoMember;
};

export type UpsertMessagesMetadataActionPayload = {
  vGroupID: string;
} & ConvoMetadata;

export type RemoveMessagesActionPayload = {
  vGroupID: string;
  removeCount: number;
  removeFrom: 'leading' | 'trailing';
  reason: MessagesUpdateReason;
};

export type ConvoNotificationPreferencesPayload = ConvoNotificationPreferences & {
  vgroudId: string;
};

export type RemoveAutoSummaryActionPayload = {
  vGroupID: string;
};

const createConvoEntity = (
  vGroupID: string,
  convo?: Partial<WickrConvo>,
  messages = messagesAdapter.getInitialState()
): ConvoEntity => ({
  // default values if not in convo
  type: ConvoCollection.ConvoMeta.ConvoType.Room,
  lastReadTimeStamp: 0,
  lastUpdateTimestamp: 0,
  unacknowledgedSendErrorCount: 0,
  membersInfo: [],
  title: '',
  description: '',
  settings: {},
  unreadCount: 0,
  mentionCount: 0,
  activeConvoHasUnverifiedMembers: false,
  pinned: false,
  // convo data
  ...convo,
  // manually set
  vGroupID,
  messages,
  isMuted: false,
  syncedNotificationPreferences: false,
  muteSelfMentions: false,
  muteAllMentions: false,
  muteCalls: false,
  hideBadgeCount: false,
  muteExpiration: 0,
  canSendMessage: true, // default to true so convos don't look disabled as they load
  webApp: {
    loaded: false,
  },
  markedAsUnread: false,
});

const initialState: ConvosState = { all: {}, silencedConvos: {} };

function upsertConvo(state: ConvosState, convo: ConvoEntity) {
  state.all[convo.vGroupID] = convo;
}

export function toConvoEntityMap(convos: ConvoEntity[]): { [vgroupId: string]: ConvoEntity } {
  return Object.fromEntries(convos.map((convo) => [convo.vGroupID, convo]));
}

export const convosSlice = createSlice({
  name: 'convos',
  initialState,
  reducers: {
    upsertConvos: (state, { payload }: PayloadAction<PartialWickrConvo[]>) => {
      const convos: ConvoEntity[] = payload.map((convo) => {
        const prevOrNewConvo = state.all[convo.vGroupID] ?? createConvoEntity(convo.vGroupID);
        // Preserve silenced from previous state, or check cached silencedConvos object
        const silenced = prevOrNewConvo.silenced ?? !!state.silencedConvos[convo.vGroupID];

        return { ...prevOrNewConvo, ...convo, silenced };
      });
      convos.forEach((convo) => upsertConvo(state, convo));
    },

    upsertConvoMessages: (
      state,
      { payload: { vGroupID, messages, reason } }: MessagesPayloadAction
    ) => {
      if (!messages?.length) return;

      let convo = state.all[vGroupID];
      logger.info('upsertConvoMessages', vGroupID, redactInProd(messages, messages.length));
      if (convo) {
        messagesAdapter.upsertMany(convo.messages, messages);
      } else {
        convo = createConvoEntity(
          vGroupID,
          {},
          messagesAdapter.upsertMany({ ids: [], entities: {} }, messages)
        );
        upsertConvo(state, convo);
      }
      convo.lastMessagesUpdateReason = reason;
    },
    removeConvos: (state, { payload: vGroupIDs }: PayloadAction<string[]>) => {
      vGroupIDs.forEach((vgroupId) => delete state.all[vgroupId]);
    },
    removeConvoMessage: (
      state,
      {
        payload: { vGroupID, msgId, reason },
      }: PayloadAction<{ vGroupID: string; msgId: string; reason: MessagesUpdateReason }>
    ) => {
      const convo = state.all[vGroupID];
      if (!convo) return;
      if (!convo.messages.entities[msgId]) return;
      messagesAdapter.removeOne(convo.messages, msgId);
      convo.lastMessagesUpdateReason = reason;
    },
    /**
     * Remove all messages or some messages from a convo slice, note that it doesn't delete messages
     * @param count remove X messages from leading or trailing depends on `removeFrom`
     * @param removeFrom leading: remove from top, trailing: remove from bottom
     */
    removeConvoMessagesByCount: (
      state,
      {
        payload: { vGroupID, removeCount, removeFrom, reason },
      }: PayloadAction<RemoveMessagesActionPayload>
    ) => {
      if (removeCount <= 0) {
        return;
      }
      const convo = state.all[vGroupID];
      if (!convo) return;

      const startIndex = removeFrom === 'leading' ? 0 : convo.messages.ids.length - removeCount;
      messagesAdapter.removeMany(
        convo.messages,
        convo.messages.ids.slice(startIndex, startIndex + removeCount)
      );
      convo.lastMessagesUpdateReason = reason;
    },
    removeManyConvoMessages: (
      state,
      {
        payload: { vGroupID, ids, reason },
      }: PayloadAction<{ vGroupID: string; ids: string[]; reason: MessagesUpdateReason }>
    ) => {
      const convo = state.all[vGroupID];
      if (!convo) return;
      if (convo.messages.ids.every((id) => !convo.messages.entities[id])) return;
      messagesAdapter.removeMany(convo.messages, ids);
      convo.lastMessagesUpdateReason = reason;
    },
    removeAllConvoMessages: (
      state,
      {
        payload: { vGroupID, reason },
      }: PayloadAction<{ vGroupID: string; reason: MessagesUpdateReason }>
    ) => {
      const convo = state.all[vGroupID];
      if (!convo) return;
      if (!convo.messages.ids.length) return;
      messagesAdapter.removeAll(convo.messages);
      convo.lastMessagesUpdateReason = reason;
    },
    upsertMessagesMetadata: (
      state,
      {
        payload: {
          vGroupID,
          oldestMsgId,
          newestMsgId,
          oldestUnreadMsgId,
          oldestUnreadMentionMsgId,
          newestUnackErrorId,
        },
      }: PayloadAction<UpsertMessagesMetadataActionPayload>
    ) => {
      let convo = state.all[vGroupID];
      if (!convo) {
        convo = createConvoEntity(vGroupID);
        upsertConvo(state, convo);
      }

      convo.oldestMsgId = oldestMsgId ?? convo.oldestMsgId;
      convo.newestMsgId = newestMsgId ?? convo.newestMsgId;
      convo.oldestUnreadMsgId = oldestUnreadMsgId ?? convo.oldestUnreadMsgId;
      convo.oldestUnreadMentionMsgId = oldestUnreadMentionMsgId ?? convo.oldestUnreadMentionMsgId;
      convo.newestUnackErrorId = newestUnackErrorId ?? convo.newestUnackErrorId;
    },
    starConvoMessage: (
      state,
      { payload: { vgroupId, star, messageId } }: PayloadAction<StarMessagePayload>
    ) => {
      const convo = state.all[vgroupId] ?? createConvoEntity(vgroupId);

      const message = convo.messages.entities[messageId];
      if (!message) {
        logger.warn('removeConvoMessageReaction: no matching message');
        return;
      }

      message.starred = star;
    },
    clearConvoBotWarning: (state, { payload }: PayloadAction<ClearBotWarningPayload>) => {
      const convo = state.all[payload.vgroupId] ?? createConvoEntity(payload.vgroupId);
      convo.botWarning = false;
    },
    setActiveConvoHasUnverifiedMembers: (
      state,
      {
        payload: { vgroupId, activeConvoHasUnverifiedMembers },
      }: PayloadAction<SetActiveConvoHasUnverifiedMembersPayload>
    ) => {
      const convo = state.all[vgroupId] ?? createConvoEntity(vgroupId);
      convo.activeConvoHasUnverifiedMembers = activeConvoHasUnverifiedMembers;
    },
    setConvoWebAppLoaded: (
      state,
      { payload: { vgroupId, loaded } }: PayloadAction<{ vgroupId: string; loaded: boolean }>
    ) => {
      const convo = state.all[vgroupId] ?? createConvoEntity(vgroupId);
      (convo.webApp ??= { loaded }).loaded = loaded;
    },
    setConvoWebAppUrl: (
      state,
      { payload: { vgroupId, url } }: PayloadAction<{ vgroupId: string; url: string }>
    ) => {
      const convo = state.all[vgroupId] ?? createConvoEntity(vgroupId);
      (convo.webApp ??= { loaded: false }).url = url;
    },
    setMessagePendingEdit: (
      state,
      {
        payload: { vGroupID, msgId, messageContent },
      }: PayloadAction<{ vGroupID: string; msgId: string; messageContent: string }>
    ) => {
      const convo = state.all[vGroupID];
      if (!convo) {
        logger.warn('setMessagePendingEdit: no matching convo');
        return;
      }

      const message = convo.messages.entities[msgId];
      if (!message) {
        logger.warn('setMessagePendingEdit: no matching message');
        return;
      }

      convo.messages.entities[msgId] = {
        ...message,
        textContent: messageContent,
        outboxStatus: WickrOutboxStatus.Outbox_Sending,
      };
    },
    setMessageTranslationPending: (
      state,
      {
        payload: { vgroupId, messageId, msgTranslationPending },
      }: PayloadAction<{ vgroupId: string; messageId: string; msgTranslationPending: boolean }>
    ) => {
      const convo = state.all[vgroupId];
      if (!convo) {
        logger.warn('setMsgTranslationPending: no matching convo');
        return;
      }

      const message = convo.messages.entities[messageId];
      if (!message) {
        logger.warn('setMsgTranslationPending: no matching message');
        return;
      }

      message.msgTranslationPending = msgTranslationPending;
    },
    setConvoSilenced: (
      state,
      { payload: { vgroupId, silenced } }: PayloadAction<{ vgroupId: string; silenced: boolean }>
    ) => {
      const convo = state.all[vgroupId];
      if (!convo) {
        logger.warn('setConvoSilenced: no matching convo');
        return;
      }
      convo.silenced = silenced;

      // Update cached silencedConvos object
      if (silenced) {
        state.silencedConvos[vgroupId] = true;
      } else {
        delete state.silencedConvos[vgroupId];
      }
    },
    setSilencedConvos: (state, { payload }: PayloadAction<string[]>) => {
      // Load silenced convos from storage
      state.silencedConvos = Object.fromEntries(payload.map((id) => [id, true]));
    },
  },
  extraReducers(builder) {
    builder.addCase(resetSlice, createResetSliceReducer('convos', initialState));
  },
});

export const convosReducer = convosSlice.reducer;
export const {
  upsertConvos,
  upsertConvoMessages,
  removeConvos,
  removeConvoMessage,
  removeConvoMessagesByCount,
  removeManyConvoMessages,
  removeAllConvoMessages,
  upsertMessagesMetadata,
  starConvoMessage,
  setActiveConvoHasUnverifiedMembers,
  setMessagePendingEdit,
  clearConvoBotWarning,
  setMessageTranslationPending,
  setConvoWebAppLoaded,
  setConvoWebAppUrl,
  setConvoSilenced,
  setSilencedConvos,
} = convosSlice.actions;
