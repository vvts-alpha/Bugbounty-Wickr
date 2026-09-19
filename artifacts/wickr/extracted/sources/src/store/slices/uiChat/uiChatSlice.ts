import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import isEqual from 'lodash/isEqual';
import { createResetSliceReducer, resetSlice } from '../shared';
import {
  TypingActivity,
  FileStatusChangedResult,
  UnreadMessagesCountPayload,
} from '@/apis/webChannel/BridgeWebChannel';
import { WickrMessage } from '@/lib/protobuf/messages';
import {
  UIChat,
  ReplyOrEditMessage,
  DraftMessage,
  VoiceMessage,
  ConnectionStatus,
  ConvoTab,
  WickrView,
} from './uiChatModels';

const initialState: UIChat = {
  activeConvoId: '',
  scrollToMsgId: '',
  highlightedMsgId: '',
  draftMsgs: {},
  typingActivities: undefined,
  moderatorTipDismissedList: [],
  fileTransferBanners: [],
  connectionStatus: 'connected',
  clientSynchronized: false,
  panelMessage: undefined,
  activeTab: undefined,
  unreadRoomCount: 0,
  unreadGroupCount: 0,
  unreadDMCount: 0,
  activeChatView: 'messages',
};

export const uiChatSlice = createSlice({
  name: 'uiChat',
  initialState,
  reducers: {
    setActiveConvoId: (state, { payload }: PayloadAction<string>) => {
      state.activeConvoId = payload;
    },
    clearActiveConvoId: (state) => {
      state.activeConvoId = '';
    },
    setScrollToMsgId: (state, { payload: msgId }: PayloadAction<string | undefined>) => {
      state.scrollToMsgId = msgId;
    },
    clearScrollToMsgId: (state) => {
      delete state.scrollToMsgId;
    },
    setHighlightedMsgId: (state, { payload }: PayloadAction<string>) => {
      state.highlightedMsgId = payload;
    },
    /** Clear highlightedMsgId if it matches the payload or if the payload is falsy */
    clearHighlightedMsgId: (state, { payload }: PayloadAction<string | undefined>) => {
      if (!payload || payload === state.highlightedMsgId) {
        delete state.highlightedMsgId;
      }
    },
    setActiveReplyOrEditMsg: (state, action: PayloadAction<ReplyOrEditMessage | undefined>) => {
      state.activeReplyOrEditMsg = action.payload;
    },
    setDraftMessage: (
      state,
      { payload: { message, vGroupId } }: PayloadAction<{ message: DraftMessage; vGroupId: string }>
    ) => {
      state.draftMsgs[vGroupId] = message;
    },
    clearDraftMessage: (state, { payload: { vGroupId } }: PayloadAction<{ vGroupId: string }>) => {
      delete state.draftMsgs[vGroupId];
    },
    setVoiceMessage: (state, { payload }: PayloadAction<VoiceMessage | undefined>) => {
      state.voiceMessage = payload;
    },
    setActiveTypingActivities: (
      state,
      {
        payload: { typingActivities, vgroupId },
      }: PayloadAction<{ typingActivities: TypingActivity[]; vgroupId: string }>
    ) => {
      // Check for diff on incoming so we can skip a state update if only the order changed
      const sortedActivities = typingActivities
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name) || a.activity.localeCompare(b.activity));
      if (
        !isEqual(sortedActivities, state.typingActivities?.activities) ||
        vgroupId !== state.typingActivities?.vgroupId
      ) {
        state.typingActivities = {
          vgroupId,
          activities: sortedActivities,
        };
      }
    },
    clearTypingActivities: (state) => {
      delete state.typingActivities;
    },
    setModeratorTipDismissedList: (state, { payload }: PayloadAction<string[]>) => {
      state.moderatorTipDismissedList = payload;
    },
    updateFileTransferBanners: (state, { payload }: PayloadAction<FileStatusChangedResult>) => {
      if (!payload.showProgressBar) return;

      if (payload.status === 'complete') {
        state.fileTransferBanners = state.fileTransferBanners.filter(
          (item) => item.uuid !== payload.uuid
        );
        return;
      }

      let itemExists = false;
      state.fileTransferBanners = state.fileTransferBanners.map((item) => {
        if (item.uuid === payload.uuid) {
          itemExists = true;
          return payload;
        } else {
          return item;
        }
      });

      if (!itemExists) {
        state.fileTransferBanners.push(payload);
      }
    },
    clearFileTransferBanner: (state, { payload }: PayloadAction<string>) => {
      state.fileTransferBanners = state.fileTransferBanners.filter((item) => item.uuid !== payload);
    },
    setConnectionStatus: (state, { payload }: PayloadAction<ConnectionStatus>) => {
      state.connectionStatus = payload;
    },
    setClientSynchronization: (state, { payload }: PayloadAction<boolean>) => {
      state.clientSynchronized = payload;
    },
    setPanelMessage: (state, { payload }: PayloadAction<WickrMessage>) => {
      state.panelMessage = payload;
    },
    clearPanelMessgae: (state) => {
      delete state.panelMessage;
    },
    setActiveTab: (state, { payload }: PayloadAction<ConvoTab>) => {
      state.activeTab = payload;
    },
    clearActiveTab: (state) => {
      delete state.activeTab;
    },
    setUnreadMessagesCount: (state, { payload }: PayloadAction<UnreadMessagesCountPayload>) => {
      state.unreadRoomCount = payload.messageUnreadRoomCount;
      state.unreadGroupCount = payload.messageUnreadGroupCount;
      state.unreadDMCount = payload.messageUnreadDMCount;
    },
    setActiveChatView: (state, { payload }: PayloadAction<WickrView>) => {
      state.activeChatView = payload;
    },
  },
  extraReducers(builder) {
    builder.addCase(resetSlice, createResetSliceReducer('uiChat', initialState));
  },
});

export const uiChatReducer = uiChatSlice.reducer;

export const {
  setActiveConvoId,
  clearActiveConvoId,
  setScrollToMsgId,
  clearScrollToMsgId,
  setHighlightedMsgId,
  clearHighlightedMsgId,
  setActiveReplyOrEditMsg,
  setDraftMessage,
  clearDraftMessage,
  setVoiceMessage,
  setActiveTypingActivities,
  clearTypingActivities,
  setModeratorTipDismissedList,
  updateFileTransferBanners,
  clearFileTransferBanner,
  setConnectionStatus,
  setClientSynchronization,
  setPanelMessage,
  setActiveTab,
  clearActiveTab,
  setUnreadMessagesCount,
  setActiveChatView,
} = uiChatSlice.actions;
