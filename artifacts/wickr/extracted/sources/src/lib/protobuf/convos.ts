import {
  ConvoBackup,
  ConvoCollection,
  ConvoListCollection,
} from '@amzn/wickr-messaging-protocol-proto';
import { secondsToMilliseconds } from 'date-fns';
import { microsecondsToMilliseconds } from '@/utils/date';
import { withoutNilProperties } from '@/utils/lang';
import { WickrConvoMember, userItemToWickrUser } from './contacts';
import { WickrConvoMemberInfo, convoMembersToWickrUsersAndMembersInfo, WickrUser } from './users';
import { hasRequiredKeysFactory } from './utils';

export type RequiredConvoInfo = OptionalExceptForRequiredNonNullable<
  ConvoBackup.IConvoInfo & ConvoCollection.IConvoMeta,
  // IConfoInfo
  | 'vGroupID'
  | 'participants'
  | 'settings'
  // | 'messages'
  | 'lastReadTimeStamp'
  | 'lastUpdateTimestamp'
  // | 'privateProperties'
  // IConvoMeta
  | 'type'
  | 'members'
  | 'unreadCount'
  | 'mentionCount'
  | 'description'
  | 'unacknowledgedSendErrorCount'
  // | 'activeCall'
  | 'isMuted'
>;

export const isRequiredConvoInfo = hasRequiredKeysFactory<RequiredConvoInfo>([
  'vGroupID',
  'settings',
  'lastReadTimeStamp',
  'lastUpdateTimestamp',
  'type',
]);

type RequiredConvoListItemInfo = OptionalExceptForRequiredNonNullable<
  ConvoListCollection.IConvoListItem,
  'vgroupId'
>;

const isRequiredConvoListItemInfo = hasRequiredKeysFactory<RequiredConvoListItemInfo>(['vgroupId']);

export type WickrConvoListItem = RequiredConvoListItemInfo;

export type ConvoNotificationPreferences = {
  isMuted?: boolean | null;
  muteSelfMentions?: boolean | null;
  muteAllMentions?: boolean | null;
  syncedNotificationPreferences?: boolean | null;
  muteCalls?: boolean | null;
  hideBadgeCount?: boolean | null;
  muteExpiration?: number | null;
};

export type RoleBaseAccessControl = {
  canAddUser?: boolean;
  canRemoveUser?: boolean;
  canDeleteConvo?: boolean;
  canLeaveConvo?: boolean;
  canSendMessage?: boolean;
  canModifyUserRole?: boolean;
  canModifyTitleDescription?: boolean;
  canModifyEphemerality?: boolean;
  canModifyPinnedFilesLinks?: boolean;
};

export type WickrConvo = OmitNullableKeys<Omit<RequiredConvoInfo, 'participants' | 'members'>> &
  ConvoNotificationPreferences &
  RoleBaseAccessControl & {
    title?: string;
    description: string;
    membersInfo: WickrConvoMemberInfo[];
    activeCall?: boolean | null;
    isBot?: boolean | null;
    isModerator?: boolean | null;
    dmUserId?: string | null;
    dmUserHash?: string | null;
    groupMemberCount?: number | null;
    typing?: boolean | null;
    containsExternal?: boolean | null;
    moderatorCount?: number | null;
    pinned?: boolean | null;
    botWarning?: boolean | null;
    displayTimestamp?: number;
    sortTimestamp?: number;
    inactive?: boolean;
    resendInProgress?: boolean;
    crossBoundary?: boolean;
    guardWarning?: boolean | null;
    guardText?: string | null;
    guardTagColor?: string | null;
    isMLS?: boolean | null;
    isMLSSynced?: boolean | null;
    rbacMask?: number | null;
    markedAsUnread?: boolean | null;
    isUnauthorized?: boolean | null;
    tdfTags?: string[];
    shortenedTdfTags?: string[];
  };

/** A WickrConvo that has at least a vGroupID */
export type PartialWickrConvo = Pick<WickrConvo, 'vGroupID'> &
  Partial<Omit<WickrConvo, 'vGroupID'>>;

export const WickrConvoType = ConvoCollection.ConvoMeta.ConvoType;

/**
 * Converts a numeric permission mask into an object containing boolean RBAC permissions
 * @param mask - A numeric bitmask representing the user's permissions
 * @returns {RoleBaseAccessControl} An object containing boolean values for each permission.
 * https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Bitwise_AND
 */
const getRbacPermissions = (mask: number): RoleBaseAccessControl => {
  return {
    canAddUser: Boolean(0x01 & mask),
    canRemoveUser: Boolean(0x02 & mask),
    canDeleteConvo: Boolean(0x04 & mask),
    canLeaveConvo: Boolean(0x08 & mask),
    canSendMessage: Boolean(0x10 & mask),
    canModifyUserRole: Boolean(0x20 & mask),
    canModifyTitleDescription: Boolean(0x40 & mask),
    canModifyEphemerality: Boolean(0x80 & mask),
    canModifyPinnedFilesLinks: Boolean(0x100 & mask),
  };
};

export const convoCollectionToWickrConvosAndUsers = (
  collection: ConvoCollection
): { convos: WickrConvo[]; users: WickrUser[] } => {
  const usersMap: Record<string, WickrUser> = {};

  const convos = collection.convoItem
    .map((convo) => {
      const rooms = convo.rooms ?? {};
      const { state, ...roomRest } = rooms;
      // Merging these fields since they contain nearly the same information, and state contains settings
      const merged = { ...convo.convoMeta, ...convo.convos, ...roomRest, ...state };
      const { fileVaultInfo, activeMembers, messages, controlInfo, ...rest } = merged;
      return rest;
    })
    .filter(isRequiredConvoInfo)
    .filter((convo) => Boolean(convo.vGroupID))
    .map(
      ({
        settings,
        members,
        participants,
        privateProperties,
        lastReadTimeStamp,
        lastUpdateTimestamp,
        muteExpiration,
        rbacMask,
        shortenedTdfTags,
        ...rest
      }) => {
        // Convert these classes into vanilla objects for better diffing in redux
        const settingsObj = { ...settings };
        if (settingsObj.ttl) {
          settingsObj.ttl = secondsToMilliseconds(settingsObj.ttl);
        }
        if (settingsObj.bor) {
          settingsObj.bor = secondsToMilliseconds(settingsObj.bor);
        }
        const { users, membersInfo } = convoMembersToWickrUsersAndMembersInfo(members);
        users.forEach((user) => (usersMap[user.idHash] = user));
        // A muteExpiration of -1 means muted indefinitely.
        // We should not convert that value to ms.
        const muteExpirationMs =
          muteExpiration && muteExpiration !== -1 ? secondsToMilliseconds(muteExpiration) : -1;
        const rbacPermissions = getRbacPermissions(rbacMask ?? 0);

        return {
          ...rest,
          lastReadTimeStamp: microsecondsToMilliseconds(lastReadTimeStamp),
          lastUpdateTimestamp: secondsToMilliseconds(lastUpdateTimestamp),
          description: settings.desc ?? '',
          settings: settingsObj,
          pinned: privateProperties?.pinned || false,
          membersInfo,
          muteExpiration: muteExpirationMs,
          rbacMask,
          ...rbacPermissions,
          shortenedTdfTags: shortenedTdfTags ?? undefined,
        };
      }
    );
  const users = Object.values(usersMap);
  return { convos, users };
};

export const convoListCollectionToWickrConvoListItems = (
  convoListCollection: ConvoListCollection
): WickrConvoListItem[] => {
  return convoListCollection.convoListItem.filter(isRequiredConvoListItemInfo);
};

export function memberCollectionToWickrConvoMembers(
  members: ConvoCollection.ConvoMeta.IConvoMember[]
): WickrConvoMember[] {
  return members.flatMap((member) => {
    const user = convoMemberToWickrConvoMember(member);
    return user ? [user] : [];
  });
}

export const convoMemberToWickrConvoMember = (
  member: ConvoCollection.ConvoMeta.IConvoMember
): WickrConvoMember | undefined => {
  const user = userItemToWickrUser(member.user);
  if (!user) {
    return;
  }

  return {
    moderator: member.moderator ?? false,
    ...user,
  };
};

export function convoListItemToWickrConvo(item: WickrConvoListItem): PartialWickrConvo {
  const {
    activeCall,
    convoTitle,
    convoType,
    displayTimestamp,
    sortTimestamp,
    mentionCount,
    unacknowledgedSendErrorCount,
    unreadCount,
    vgroupId,
    isModerator,
    isBot,
    isMLS,
    moderatorCount,
    pinned,
    dmUserId,
    dmUserHash,
    groupMemberCount,
    typing,
    containsExternal,
    inactive,
    resendInProgress,
    crossBoundary,
    isMuted,
    rbacMask,
    markedAsUnread,
  } = item;

  // displayTimestamp is in microseconds
  const displayTimestampMilliseconds = displayTimestamp
    ? microsecondsToMilliseconds(displayTimestamp)
    : undefined;
  const sortTimestampMilliseconds = sortTimestamp
    ? microsecondsToMilliseconds(sortTimestamp)
    : undefined;

  // remove null and undefined properties so they do not squash existing props when { ...merged }
  return withoutNilProperties({
    activeCall,
    displayTimestamp: displayTimestampMilliseconds,
    sortTimestamp: sortTimestampMilliseconds,
    mentionCount,
    title: convoTitle,
    type: convoType,
    unacknowledgedSendErrorCount,
    unreadCount,
    vGroupID: vgroupId,
    moderatorCount: moderatorCount ?? 0,
    isModerator,
    isBot,
    isMLS,
    pinned,
    dmUserId,
    dmUserHash,
    groupMemberCount,
    typing,
    containsExternal,
    inactive,
    resendInProgress,
    crossBoundary,
    isMuted,
    ...getRbacPermissions(rbacMask ?? 0),
    markedAsUnread,
  });
}

/**
 * Type of convo can be inferred from first letter of vGroupID
 * S = Secure room, G = group, anything else = DM
 */
export function inferConvoTypeFromId(vGroupID: string): ConvoCollection.ConvoMeta.ConvoType {
  if (vGroupID.startsWith('S')) return WickrConvoType.Room;
  if (vGroupID.startsWith('G')) return WickrConvoType.Group;
  return WickrConvoType.DM;
}

/** Returns true if this is a group conversation */
export function isConvoGroup(vGroupID: string) {
  return inferConvoTypeFromId(vGroupID) === WickrConvoType.Group;
}

/** Returns true if this is a secure room */
export function isConvoRoom(vGroupID: string) {
  return inferConvoTypeFromId(vGroupID) === WickrConvoType.Room;
}

/** Returns true if this is a DM */
export function isConvoDM(vGroupID: string) {
  return inferConvoTypeFromId(vGroupID) === WickrConvoType.DM;
}
