import { createSelector } from '@reduxjs/toolkit';
import isEqual from 'lodash/isEqual';
import { ConvoListSortMode } from '../settings';
import { selectUserByIdHash } from '../users';
import { ConvoBoundaryIds } from '@/apis/webChannel/BridgeWebChannel';
import { WickrConvoType, inferConvoTypeFromId } from '@/lib/protobuf/convos';
import { isServerMessage } from '@/lib/protobuf/messages';
import { WickrConvoMember, WickrConvoMemberInfo } from '@/lib/protobuf/users';
import { AppRootState } from '@/store/models';
import { createActiveConvoSelector, selectActiveConvoId } from '@/store/slices/shared';
import { isValidEmail } from '@/utils/strings';
import { ConvoEntity } from './convosModels';
import { messagesAdapter } from './messagesAdapter';

const selectAppRoot = (state: AppRootState) => state;
const selectConvoRoot = (state: AppRootState) => state.convos;

export const selectConvo = createSelector(
  selectConvoRoot,
  (_: any, vgroupId?: string) => vgroupId,
  (root, vgroupId) => (vgroupId ? root.all[vgroupId] : null)
);

export const selectAllConvos = createSelector(selectConvoRoot, (root) => Object.values(root.all));

const selectConvoMessageEntities = createSelector(selectConvo, (convo) => convo?.messages);
const selectConvoBoundaryIds = createSelector(
  selectConvo,
  (convo): ConvoBoundaryIds => ({
    newestId: convo?.newestMsgId,
    oldestId: convo?.oldestMsgId,
    oldestUnreadId: convo?.oldestUnreadMsgId,
    newestUnackErrorId: convo?.newestUnackErrorId,
    oldestUnreadMentionId: convo?.oldestUnreadMentionMsgId,
  })
);
export const selectConvoNewestMsgId = createSelector(selectConvo, (convo) => convo?.newestMsgId);
export const selectConvoOldestMsgId = createSelector(selectConvo, (convo) => convo?.oldestMsgId);
const selectConvoOldestUnreadMentionId = createSelector(
  selectConvo,
  (convo) => convo?.oldestUnreadMentionMsgId
);
const selectOldestUnreadMsgId = createSelector(selectConvo, (convo) => convo?.oldestUnreadMsgId);
const selectNewestUnackErrorId = createSelector(selectConvo, (convo) => convo?.newestUnackErrorId);

const selectLastMessagesUpdateReason = createSelector(
  selectConvo,
  (convo) => convo?.lastMessagesUpdateReason
);

// do not scope here, instead pass via selectMessageEntitiesByConvoId
const msgSelectors = messagesAdapter.getSelectors();

export const selectConvoMessages = createSelector(selectConvoMessageEntities, (msgs) => {
  if (!msgs) return [];
  try {
    return msgSelectors.selectAll(msgs);
  } catch {
    return [];
  }
});

export const selectConvoServerMessages = createSelector(selectConvoMessages, (msgs) => {
  return msgs.filter((msg) => isServerMessage(msg));
});

export const selectActiveConvoMessages = createActiveConvoSelector(selectConvoMessages);
export const selectActiveConvoServerMessages = createActiveConvoSelector(selectConvoServerMessages);
export const selectActiveConvoLastMessagesUpdateReason = createActiveConvoSelector(
  selectLastMessagesUpdateReason
);

export const selectConvoMessage = createSelector(
  selectConvoMessageEntities,
  (_state: AppRootState, _vGroupId: string, msgId: string) => msgId,
  (msgs, msgId) => {
    if (msgs) {
      const msg = msgs.entities[msgId];
      return msg;
    }
  }
);

export const selectActiveConvoMessage = createSelector(
  selectAppRoot,
  selectActiveConvoId,
  (_state: AppRootState, msgId: string) => msgId,
  selectConvoMessage
);

/** Get the convo type from the store, falling back to inferring from the ID prefix */
export const selectConvoType = createSelector(
  selectConvo,
  (_: AppRootState, convoId: string) => convoId,
  (convo, convoId) => convo?.type ?? inferConvoTypeFromId(convoId)
);

export const selectActiveConvoType = createActiveConvoSelector(selectConvoType);

export const selectConvoGuardText = createSelector(selectConvo, (convo) =>
  convo?.guardText === '<invalid label>' ? undefined : convo?.guardText
);

export const selectActiveConvoGuardText = createActiveConvoSelector(selectConvoGuardText);

export const selectConvoGuardTagColor = createSelector(
  selectConvo,
  (convo) => convo?.guardTagColor
);

export const selectActiveConvoGuardTagColor = createActiveConvoSelector(selectConvoGuardTagColor);

export const selectConvoGuardWarning = createSelector(selectConvo, (convo) => convo?.guardWarning);

export const selectActiveConvoGuardWarning = createActiveConvoSelector(selectConvoGuardWarning);

export const selectConvoShortenedTdfTags = createSelector(
  selectConvo,
  (convo) => convo?.shortenedTdfTags || []
);
export const selectActiveConvoShortenedTdfTags = createActiveConvoSelector(
  selectConvoShortenedTdfTags
);

export const selectConvoTitle = createSelector(selectConvo, (convo) => convo?.title || '');

export const selectConvoIsMLS = createSelector(selectConvo, (convo) => convo?.isMLS);

export const selectActiveConvoIsMLS = createActiveConvoSelector(selectConvoIsMLS);

export const selectActiveConvoTitle = createActiveConvoSelector(selectConvoTitle);

export const selectConvoActiveCall = createSelector(selectConvo, (convo) => convo?.activeCall);

export const selectActiveConvoActiveCall = createActiveConvoSelector(selectConvoActiveCall);

export const selectConvoDescription = createSelector(selectConvo, (convo) => convo?.description);

export const selectActiveConvoDescription = createActiveConvoSelector(selectConvoDescription);

export const selectConvoIsBot = createSelector(selectConvo, (convo) => convo?.isBot);

export const selectActiveConvoIsBot = createActiveConvoSelector(selectConvoIsBot);

export const selectConvoCrossBoundary = createSelector(
  selectConvo,
  (convo) => convo?.crossBoundary
);

export const selectActiveConvoCrossBoundary = createActiveConvoSelector(selectConvoCrossBoundary);

export const selectActiveConvoBoundaryIds = createActiveConvoSelector(selectConvoBoundaryIds);

export const selectActiveConvoNewestMsgId = createActiveConvoSelector(selectConvoNewestMsgId);

export const selectActiveConvoOldestUnreadMsgId =
  createActiveConvoSelector(selectOldestUnreadMsgId);

export const selectActiveConvoOldestMsgId = createActiveConvoSelector(selectConvoOldestMsgId);

export const selectActiveConvoOldestUnreadMentionId = createActiveConvoSelector(
  selectConvoOldestUnreadMentionId
);

export const selectActiveConvoNewestUnackErrorId =
  createActiveConvoSelector(selectNewestUnackErrorId);

export const selectConvoMemberIds = createSelector(selectConvo, (convo) =>
  convo?.membersInfo.map((m) => m.idHash)
);

export const selectActiveConvoMemberIds = createActiveConvoSelector(selectConvoMemberIds);

export const selectConvoIsMuted = createSelector(selectConvo, (convo) => !!convo?.isMuted);

export const selectActiveConvoIsMuted = createActiveConvoSelector(selectConvoIsMuted);

export const selectConvoSyncedNotificationPreferences = createSelector(
  selectConvo,
  (convo) => !!convo?.syncedNotificationPreferences
);

export const selectActiveConvoSyncedNotificationPreferences = createActiveConvoSelector(
  selectConvoSyncedNotificationPreferences
);

export const selectConvoMuteExpiration = createSelector(
  selectConvo,
  (convo) => convo?.muteExpiration ?? 0
);

export const selectActiveConvoMuteExpiration = createActiveConvoSelector(selectConvoMuteExpiration);

export const selectConvoMuteCalls = createSelector(selectConvo, (convo) => !!convo?.muteCalls);

export const selectActiveConvoMuteCalls = createActiveConvoSelector(selectConvoMuteCalls);

export const selectConvoMuteSelfMentions = createSelector(
  selectConvo,
  (convo) => !!convo?.muteSelfMentions
);

export const selectActiveConvoMuteSelfMentions = createActiveConvoSelector(
  selectConvoMuteSelfMentions
);

export const selectConvoMuteAllMentions = createSelector(
  selectConvo,
  (convo) => !!convo?.muteAllMentions
);

export const selectActiveConvoMuteAllMentions = createActiveConvoSelector(
  selectConvoMuteAllMentions
);

export const selectConvoHideBadgeCount = createSelector(
  selectConvo,
  (convo) => !!convo?.hideBadgeCount
);

export const selectActiveConvoHideBadgeCount = createActiveConvoSelector(selectConvoHideBadgeCount);

export const selectConvoSilenced = createSelector(selectConvo, (convo) => !!convo?.silenced);

export const selectActiveConvoSilenced = createActiveConvoSelector(selectConvoSilenced);

/**
 * Merges usersSlice WickrUser with convosSlice WickrConvoMemberInfo to produce WickrConvoMembers.
 * Does not use createSelector because it requires multiple slices (users and convos), and it makes
 * createSelector ends up re-computing the value on _every_ redux change.
 */
function createConvoMembersSelector() {
  // Use a stable array for no users
  const emptyMembersArray: WickrConvoMemberInfo[] = [];

  const selectConvoMembersInfo = createSelector(
    selectConvo,
    (convo) => convo?.membersInfo ?? emptyMembersArray
  );

  // Only cache the most-recent convos' users
  let cachedConvoId = '';
  let cachedUsers: WickrConvoMember[] = [];

  return function selectConvoMembers(state: AppRootState, convoId: string): WickrConvoMember[] {
    // compute the members
    const membersInfo = selectConvoMembersInfo(state, convoId);
    const users = membersInfo
      .map(({ idHash, ...data }) => ({ ...selectUserByIdHash(state, idHash), ...data }))
      .filter((user): user is WickrConvoMember => !!user);
    // do a deep comparison so we only return something different when the "value" changes
    if (convoId !== cachedConvoId || !isEqual(users, cachedUsers)) {
      cachedConvoId = convoId;
      cachedUsers = users;
    }
    return cachedUsers;
  };
}

export const selectConvoMembers = createConvoMembersSelector();

export const selectActiveConvoMembers = createSelector(
  selectAppRoot,
  selectActiveConvoId,
  selectConvoMembers
);

export const selectActiveConvoSelfMember = createSelector(selectActiveConvoMembers, (members) =>
  members.find((m) => m.selfUser)
);

export const selectActiveConvoOtherMembers = createSelector(selectActiveConvoMembers, (members) =>
  members.filter((m) => !m.selfUser)
);

export const selectActiveConvoExternalMembers = createSelector(
  selectActiveConvoMembers,
  (members) => members.filter((m) => !m.inNetwork)
);

export const selectActiveConvoNonGuestMembersCount = createSelector(
  selectActiveConvoMembers,
  (members) => {
    const nonGuestMembers = members.filter((m) => !m.isGuest);
    return nonGuestMembers.length;
  }
);

export const selectActiveConvoBotMembers = createSelector(selectActiveConvoMembers, (members) =>
  members.filter((m) => m.isBot)
);

export const selectActiveConvoInactiveMembers = createSelector(
  selectActiveConvoMembers,
  (members) => members.filter((m) => m.inactive)
);

export const selectActiveConvoModerators = createSelector(selectActiveConvoMembers, (members) =>
  members.filter((m) => m.moderator)
);

export const selectConvoModerators = createSelector(selectConvoMembers, (members) =>
  members.filter((m) => m.moderator)
);

export const selectActiveConvoModeratorIds = createSelector(selectActiveConvoModerators, (users) =>
  users.map((user) => user.id)
);

export const selectConvoMembersMap = createSelector(selectConvoMembers, (members) =>
  Object.fromEntries(members.map((member) => [member.idHash, member]))
);

export const selectActiveConvoMembersMap = createActiveConvoSelector(selectConvoMembersMap);

export const selectConvoMemberByIdHash = createSelector(
  selectConvoMembers,
  (_: AppRootState, _vgroupId: string, idHash: string) => idHash,
  (members, idHash) => {
    return members.find((member) => member.idHash === idHash);
  }
);

export const selectConvoMemberOrUserByIdHash = createSelector(
  selectConvoMemberByIdHash,
  selectUserByIdHash,
  (convoMember, user) => convoMember ?? user
);

export const selectConvoMembersByIdHashes = createSelector(
  selectConvoMembers,
  (_: AppRootState, _vgroupId: string, idHashes: string[]) => idHashes,
  (members, idHashes) => {
    return idHashes
      .map((idHash) => members.find((member) => member.idHash === idHash))
      .filter((member): member is WickrConvoMember => !!member);
  }
);

export const selectActiveConvoMemberByIdHash = createSelector(
  selectAppRoot,
  selectActiveConvoId,
  (_: AppRootState, idHash: string) => idHash,
  selectConvoMemberByIdHash
);

export const selectActiveConvoMembersByIdHashes = createSelector(
  selectAppRoot,
  selectActiveConvoId,
  (_: AppRootState, idHashes: string[]) => idHashes,
  selectConvoMembersByIdHashes
);

export const selectConvoHasGuestUsers = createSelector(selectConvoMembers, (members) =>
  members.some((m) => m.isGuest)
);

export const selectConvoUnauthorizedMembers = createSelector(selectConvoMembers, (members) =>
  members.filter((m) => !!m.isUnauthorized)
);

export const selectActiveConvoUnauthorizedMembers = createActiveConvoSelector(
  selectConvoUnauthorizedMembers
);

export const selectConvoHasUnauthorizedMembers = createSelector(
  selectConvoUnauthorizedMembers,
  (members) => members.length > 0
);

export const selectActiveConvoHasUnauthorizedMembers = createActiveConvoSelector(
  selectConvoHasUnauthorizedMembers
);

export const selectActiveConvoSelfUserIsUnauthorized = createSelector(
  selectActiveConvoUnauthorizedMembers,
  selectActiveConvoSelfMember,
  (unauthorizedMembers, selfMember) => {
    if (!selfMember) return false;
    return unauthorizedMembers.some((member) => member.idHash === selfMember.idHash);
  }
);

export const selectConvoUnreadMessagesCount = createSelector(
  selectConvo,
  (convo) => convo?.unreadCount
);

export const selectActiveConvoUnreadMessagesCount = createActiveConvoSelector(
  selectConvoUnreadMessagesCount
);

export const selectConvoUnreadMentionsCount = createSelector(
  selectConvo,
  (convo) => convo?.mentionCount
);

export const selectActiveConvoUnreadMentionMessagesCount = createActiveConvoSelector(
  selectConvoUnreadMentionsCount
);

export const selectConvoUnacknowledgedSendErrorCount = createSelector(
  selectConvo,
  (convo) => convo?.unacknowledgedSendErrorCount
);

export const selectActiveConvoUnacknowledgedSendErrorCount = createActiveConvoSelector(
  selectConvoUnacknowledgedSendErrorCount
);

export const selectConvoBor = createSelector(selectConvo, (convo) => convo?.settings.bor);

export const selectActiveConvoBor = createActiveConvoSelector(selectConvoBor);

export const selectConvoHasUnverifiedMembers = createSelector(
  selectConvo,
  (convo) => convo?.activeConvoHasUnverifiedMembers
);

export const selectActiveConvoHasUnverifiedMembers = createActiveConvoSelector(
  selectConvoHasUnverifiedMembers
);

export const selectSelfUserIsModeratorInConvo = createSelector(
  selectConvo,
  (convo) => !!convo?.isModerator
);

const selectConvoCanPerformModeratorActions = createSelector(selectConvo, (convo) => {
  return (
    convo &&
    ((convo.type === WickrConvoType.Room && convo.isModerator) ||
      convo.type === WickrConvoType.Group)
  );
});

export const selectActiveConvoShowModeratorActions = createSelector(
  createActiveConvoSelector(selectConvoCanPerformModeratorActions),
  selectActiveConvoSelfMember,
  (canPerformModeratorActions, selfMember) => {
    return canPerformModeratorActions && selfMember && !selfMember.isGuest;
  }
);

export const selectConvoTtl = createSelector(selectConvo, (convo) => convo?.settings.ttl);

export const selectActiveConvoTtl = createActiveConvoSelector(selectConvoTtl);

export const selectConvoBotWarning = createSelector(selectConvo, (entry) => !!entry?.botWarning);

export const selectActiveConvoBotWarning = createActiveConvoSelector(selectConvoBotWarning);

export const selectConvoCanAddUser = createSelector(selectConvo, (convo) => !!convo?.canAddUser);

export const selectActiveConvoCanAddUser = createActiveConvoSelector(selectConvoCanAddUser);

export const selectConvoCanRemoveUser = createSelector(
  selectConvo,
  (convo) => !!convo?.canRemoveUser
);

export const selectActiveConvoCanRemoveUser = createActiveConvoSelector(selectConvoCanRemoveUser);

export const selectConvoCanDeleteConvo = createSelector(
  selectConvo,
  (convo) => !!convo?.canDeleteConvo
);

export const selectActiveConvoCanDeleteConvo = createActiveConvoSelector(selectConvoCanDeleteConvo);

export const selectConvoCanLeaveConvo = createSelector(
  selectConvo,
  (convo) => !!convo?.canLeaveConvo
);

export const selectActiveConvoCanLeaveConvo = createActiveConvoSelector(selectConvoCanLeaveConvo);

export const selectConvoCanSendMessage = createSelector(
  selectConvo,
  (convo) => !!convo?.canSendMessage
);

export const selectActiveConvoCanSendMessage = createActiveConvoSelector(selectConvoCanSendMessage);

export const selectConvoCanModifyUserRole = createSelector(
  selectConvo,
  (convo) => !!convo?.canModifyUserRole
);

export const selectActiveConvoCanModifyUserRole = createActiveConvoSelector(
  selectConvoCanModifyUserRole
);

export const selectConvoCanModifyTitleDescription = createSelector(
  selectConvo,
  (convo) => !!convo?.canModifyTitleDescription
);

export const selectActiveConvoCanModifyTitleDescription = createActiveConvoSelector(
  selectConvoCanModifyTitleDescription
);

export const selectConvoCanModifyEphemerality = createSelector(
  selectConvo,
  (convo) => !!convo?.canModifyEphemerality
);

export const selectActiveConvoCanModifyEphemerality = createActiveConvoSelector(
  selectConvoCanModifyEphemerality
);

export const selectConvoCanModifyPinnedFilesLinks = createSelector(
  selectConvo,
  (convo) => !!convo?.canModifyPinnedFilesLinks
);

export const selectActiveConvoCanModifyPinnedFilesLinks = createActiveConvoSelector(
  selectConvoCanModifyPinnedFilesLinks
);

export const selectConvoMlsSynced = createSelector(selectConvo, (convo) => convo?.isMLSSynced);

export const selectActiveConvoMlsSynced = createActiveConvoSelector(selectConvoMlsSynced);

const sortConvos = (sortMode: ConvoListSortMode) => (a: ConvoEntity, b: ConvoEntity) => {
  return sortMode === 'recent'
    ? (b.sortTimestamp ?? 0) - (a.sortTimestamp ?? 0)
    : (a.title ?? '').localeCompare(b.title ?? '');
};

export const selectConvoListSortMode = createSelector(
  (state: AppRootState) => state.settings,
  (settings) => settings.convoListSortMode
);

/** Selects all convos that are unread (sorted) - excludes silenced convos only if feature is enabled */
export const selectUnreadConvos = createSelector(
  selectAllConvos,
  selectConvoListSortMode,
  (state: AppRootState) => state.features.localFeatureOverrides.SilenceConversations,
  (convos, sortMode, silenceFeatureEnabled) =>
    convos
      .filter(
        (convo) =>
          (convo.unreadCount || convo.markedAsUnread) && !(silenceFeatureEnabled && convo.silenced)
      )
      .sort(sortConvos(sortMode))
);

/** Selects all convos that are unread and not pinned (sorted) - excludes silenced convos only if feature is enabled */
export const selectUnreadUnpinnedConvos = createSelector(
  selectUnreadConvos,
  selectConvoListSortMode,
  (convos, sortMode) => convos.filter((convo) => !convo.pinned).sort(sortConvos(sortMode))
);

/** Selects all convos that are not unread AND not pinned (not sorted) - includes silenced convos with unread only if feature is enabled */
export const selectReadUnpinnedConvos = createSelector(
  selectAllConvos,
  (state: AppRootState) => state.features.localFeatureOverrides.SilenceConversations,
  (convos, silenceFeatureEnabled) =>
    convos.filter(
      (convo) =>
        (!convo.unreadCount && !convo.pinned && !convo.markedAsUnread) ||
        (silenceFeatureEnabled && convo.silenced && !convo.pinned)
    )
);

/** Selects all convos that are not pinned (sorted) */
export const selectPinnedConvos = createSelector(
  selectAllConvos,
  selectConvoListSortMode,
  (convos, sortMode) => convos.filter((convo) => convo.pinned).sort(sortConvos(sortMode))
);

/** Selects any convos that are (Rooms OR Groups) AND not unread AND not pinned (sorted) */
export const selectRoomConvos = createSelector(
  selectReadUnpinnedConvos,
  selectConvoListSortMode,
  (convos, sortMode) =>
    convos
      .filter((convo) => convo.type === WickrConvoType.Room || convo.type === WickrConvoType.Group)
      .sort(sortConvos(sortMode))
);

/** Selects all convos that are DMs AND not bots AND not unread AND not pinned (sorted) */
export const selectDMConvos = createSelector(
  selectReadUnpinnedConvos,
  selectConvoListSortMode,
  (convos, sortMode) =>
    convos
      .filter((convo) => convo.type === WickrConvoType.DM && !convo.isBot)
      .sort(sortConvos(sortMode))
);

/** Selects all convos that are bot convos AND not unread AND not pinned (sorted) */
export const selectBotConvos = createSelector(
  selectReadUnpinnedConvos,
  selectConvoListSortMode,
  (convos, sortMode) => convos.filter((convo) => convo.isBot).sort(sortConvos(sortMode))
);

/** Selects all convos except those that are pinned or unread (sorted) */
export const selectCombinedConvos = createSelector(
  selectReadUnpinnedConvos,
  selectConvoListSortMode,
  (convos, sortMode) => [...convos.sort(sortConvos(sortMode))] // create new array so that React can detect the change
);

/** Selects if the active convo is a DM with the specified userIdHash */
export const selectActiveConvoIsDMWithContact = createSelector(
  selectActiveConvoType,
  selectActiveConvoMembersMap,
  (_: AppRootState, idHash: string) => idHash,
  (type, members, idHash) => type === WickrConvoType.DM && !!members[idHash]
);

/** Select non-bot convo member names */
export const selectConvoRealMemberNames = createSelector(selectConvoMembers, (members) => {
  return members
    .filter((member) => !member.isBot)
    .map((member) => member.name)
    .filter(Boolean)
    .sort();
});

/** Select non-bot convo member emails */
export const selectConvoRealMemberEmails = createSelector(selectConvoMembers, (members) => {
  return members
    .filter((member) => !member.isBot)
    .map((member) => member.id)
    .filter(isValidEmail)
    .sort();
});

export const selectConvoMessageFileMetadata = createSelector(
  selectConvoMessage,
  (msg) => msg?.file?.fileMetadata
);

export const selectConvoWebAppUrl = createSelector(selectConvo, (convo) => convo?.webApp?.url);

export const selectActiveConvoWebAppUrl = createActiveConvoSelector(selectConvoWebAppUrl);

export const selectConvoWebAppLoaded = createSelector(
  selectConvo,
  (convo) => !!convo?.webApp?.loaded
);

export const selectActiveConvoWebAppLoaded = createActiveConvoSelector(selectConvoWebAppLoaded);
