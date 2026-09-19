import {
  ContactBackup,
  ConvoCollection,
  UserCollection,
} from '@amzn/wickr-messaging-protocol-proto';
import { hasRequiredKeysFactory } from './utils';

type RequiredContactMeta = OptionalExceptForRequiredNonNullable<
  UserCollection.IContactMeta,
  'selfUser' | 'hasProfilePicture' | 'isGuest' | 'timeIdle' | 'isBot' | 'isLocationSharing'
>;

export type RequiredContact = OptionalExceptForRequiredNonNullable<
  ContactBackup.IContact,
  'idHash' | 'id' | 'starred' | 'blocked' | 'inactive'
>;

const isRequiredContactMeta = hasRequiredKeysFactory<RequiredContactMeta>([
  'selfUser',
  'hasProfilePicture',
  'isGuest',
  'timeIdle',
  'isBot',
  'isLocationSharing',
]);

const isRequiredContact = hasRequiredKeysFactory<RequiredContact>([
  'idHash',
  'id',
  'starred',
  'blocked',
  'inactive',
]);

type RequiredUserItem = {
  userAdditionalMeta: RequiredContactMeta;
  userData: RequiredContact;
};

const isRequiredUserItem = (userItem: any): userItem is RequiredUserItem =>
  !!userItem &&
  isRequiredContactMeta(userItem.userAdditionalMeta) &&
  isRequiredContact(userItem.userData);

export type WickrUser = RequiredContactMeta & RequiredContact;

/** Spread meta and contact data into single object */
function userItemToWickrUser(userItem: any): WickrUser | undefined {
  if (isRequiredUserItem(userItem)) {
    const user = { ...userItem.userAdditionalMeta, ...userItem.userData };
    delete user.signingKey;
    return user;
  }
  return undefined;
}

// alias
type ConvoMember = ConvoCollection.ConvoMeta.IConvoMember;

/** ConvoMember is { user: WickrUser, moderator: boolean, more later... }, this type captures the fields that are not the user */
type ConvoMemberInfo = Partial<Omit<ConvoMember, 'user'>>;

/**
 * Combine member info and idHash, stored in convo.members in convosSlice
 */
export type WickrConvoMemberInfo = { idHash: string } & ConvoMemberInfo;

/**
 * Merge a WickrUser from usersSlice with WickrConvoMemberInfo from convosSlice
 * to make a room member. Selectors are used to merge these (e.g., selectConvoMembers)
 */
export type WickrConvoMember = WickrUser &
  ConvoMemberInfo & {
    moderator?: boolean | null;
    isUnauthorized?: boolean | null;
  };

/** Convert ConvoMember array to WickrUser array without additional data */
export function convoMembersToWickrUsers(members: ConvoMember[]): WickrUser[] {
  return members
    .map((member) => userItemToWickrUser(member.user))
    .filter((user): user is WickrUser => !!user);
}

export function convoMembersToWickrUsersAndMembersInfo(members: ConvoMember[]): {
  membersInfo: WickrConvoMemberInfo[];
  users: WickrUser[];
} {
  const userMap: Record<string, WickrUser> = {};
  const membersInfo = members
    .map((member) => {
      const { user, ...data } = member;
      const wickrUser = userItemToWickrUser(user);
      if (wickrUser) {
        const { idHash } = wickrUser;
        userMap[idHash] = wickrUser;
        return { ...data, idHash };
      }
    })
    .filter((data): data is WickrConvoMemberInfo => !!data);
  return { membersInfo, users: Object.values(userMap) };
}

export function selectUserIdHash(user: { idHash: string }) {
  return user.idHash;
}

/** @returns true if the value is a hex hash string of 64 characters */
export function isUserIdHash(maybeIdHash: unknown): maybeIdHash is string {
  return (
    typeof maybeIdHash === 'string' &&
    maybeIdHash.length === 64 &&
    maybeIdHash.replace(/[0-9a-f]/gi, '').length === 0
  );
}
