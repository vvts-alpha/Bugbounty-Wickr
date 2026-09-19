import { createSelector } from '@reduxjs/toolkit';
import { AppRootState } from '@/store/models';
import { selectActiveConvoId } from '@/store/slices/shared';
import { DraftMessage } from './uiChatModels';

const selectUIChat = (state: AppRootState) => state.uiChat;

export const selectScrollToMsgId = createSelector(selectUIChat, (uiChat) => uiChat.scrollToMsgId);
export const selectHighlightedMsgId = createSelector(selectUIChat, (ui) => ui.highlightedMsgId);
export const selectActiveReplyOrEditMsg = createSelector(
  selectUIChat,
  (uiChat) => uiChat.activeReplyOrEditMsg
);
export const selectActiveConvoDraftMessage = createSelector(
  selectUIChat,
  selectActiveConvoId,
  (uiChat, vGroupId): DraftMessage | undefined => uiChat.draftMsgs[vGroupId]
);

export const selectVoiceMessage = createSelector(selectUIChat, (uiChat) => uiChat.voiceMessage);

export const selectActiveConvoTypingActivities = createSelector(selectUIChat, (uiChat) =>
  uiChat.typingActivities?.vgroupId === uiChat.activeConvoId
    ? uiChat.typingActivities.activities
    : []
);

export const selectModeratorTipDismissedList = createSelector(selectUIChat, (uiChat) => {
  return uiChat.moderatorTipDismissedList;
});

export const selectShouldShowModeratorTip = createSelector(
  selectModeratorTipDismissedList,
  (_: any, convoId: string) => convoId,
  (dismissedList, convoId) => {
    return !dismissedList.includes(convoId);
  }
);

export const selectFileTransferBanners = createSelector(selectUIChat, (uiChat) => {
  return uiChat.fileTransferBanners;
});

export const selectConnectionStatus = createSelector(selectUIChat, (uiChat) => {
  return uiChat.connectionStatus;
});

export const selectClientSynchronization = createSelector(selectUIChat, (uiChat) => {
  return uiChat.clientSynchronized;
});

export const selectPanelMessage = createSelector(selectUIChat, (uiChat) => {
  return uiChat.panelMessage;
});

export const selectActiveTab = createSelector(selectUIChat, (uiChat) => uiChat.activeTab);
export const selectIsMessagesTabActive = createSelector(
  selectUIChat,
  (uiChat) => uiChat.activeTab === 'messages'
);
export const selectIsFilesTabActive = createSelector(
  selectUIChat,
  (uiChat) => uiChat.activeTab === 'files'
);

export const selectUnreadRoomCount = createSelector(
  selectUIChat,
  (uiChat) => uiChat.unreadRoomCount
);
export const selectUnreadGroupCount = createSelector(
  selectUIChat,
  (uiChat) => uiChat.unreadGroupCount
);
export const selectUnreadDMCount = createSelector(selectUIChat, (uiChat) => uiChat.unreadDMCount);
export const selectUnreadMessagesCount = createSelector(
  (state: AppRootState) => state.convos.all,
  (state: AppRootState) => state.features.localFeatureOverrides.SilenceConversations,
  (convos, silenceFeatureEnabled) => {
    // If silenced feature is enabled, only return unread count from non-silenced convos
    if (silenceFeatureEnabled) {
      return Object.values(convos).reduce((total, convo) => {
        if (!convo.silenced && convo.unreadCount) {
          return total + convo.unreadCount;
        }
        return total;
      }, 0);
    }
    // Otherwise, show count for all unread convos
    return Object.values(convos).reduce((total, convo) => {
      if (convo.unreadCount) {
        return total + convo.unreadCount;
      }
      return total;
    }, 0);
  }
);

export const selectActiveChatView = createSelector(selectUIChat, (uiChat) => uiChat.activeChatView);
export const selectIsMessagesViewActive = createSelector(
  selectUIChat,
  (uiChat) => uiChat.activeChatView === 'messages'
);

export const selectIsMeetingsViewActive = createSelector(
  selectUIChat,
  (uiChat) => uiChat.activeChatView === 'meetings'
);

export const selectIsWickrMeetingsViewActive = createSelector(
  selectUIChat,
  (uiChat) => uiChat.activeChatView === 'wickrMeetings'
);

export const selectIsIntegratedAppsViewActive = createSelector(
  selectUIChat,
  (uiChat) => uiChat.activeChatView === 'integratedApps'
);
