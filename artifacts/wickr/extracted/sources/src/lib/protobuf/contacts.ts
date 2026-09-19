import { ContactBackup, UserCollection } from '@amzn/wickr-messaging-protocol-proto';
import { Logger } from '../logger';
import { WickrUser } from './users';
import { hasRequiredKeysFactory } from './utils';

const logger = new Logger('proto/contacts');

type RequiredContactMeta = OptionalExceptForRequiredNonNullable<
  UserCollection.IContactMeta,
  'selfUser' | 'hasProfilePicture' | 'isGuest' | 'timeIdle' | 'isBot' | 'isLocationSharing'
>;

export type WickrContactMeta = RequiredContactMeta;

export type RequiredContact = OptionalExceptForRequiredNonNullable<
  ContactBackup.IContact,
  'idHash' | 'id' | 'starred' | 'blocked' | 'inactive'
>;

export type WickrContact = RequiredContact & RequiredContactMeta;

export const isRequiredContactMeta = hasRequiredKeysFactory<RequiredContactMeta>([
  'selfUser',
  'hasProfilePicture',
  'isGuest',
  'timeIdle',
  'isBot',
  'isLocationSharing',
]);

export const isRequiredContact = hasRequiredKeysFactory<RequiredContact>([
  'idHash',
  'id',
  'starred',
  'blocked',
  'inactive',
]);

export const isWickrContact = (obj: any): obj is WickrContact =>
  isRequiredContactMeta(obj) && isRequiredContact(obj);

export type WickrConvoMember = WickrUser & {
  moderator?: boolean | null;
};

export function contactBackupToWickrContacts(bkp: ContactBackup): WickrContact[] {
  return bkp.contacts
    .filter(isWickrContact)
    .map(({ signingKey, verificationStatus, ...contact }) => contact);
}

export function wickrContactToWickrConvoMember(
  contact: WickrContact | undefined
): WickrConvoMember | undefined {
  if (!contact) return;
  return { ...contact, moderator: false };
}

export function wickrConvoMembersToWickrContacts(members: WickrConvoMember[]): WickrContact[] {
  return members.map(({ moderator, ...rest }) => rest);
}

export function userItemToWickrUser(item?: UserCollection.IUserItem | null): WickrUser | undefined {
  if (!item) {
    return undefined;
  }
  const { userData, userAdditionalMeta } = UserCollection.UserItem.toObject(
    item as UserCollection.UserItem
  );
  if (isRequiredContact(userData)) {
    const {
      selfUser,
      hasProfilePicture,
      isGuest,
      timeIdle,
      isBot,
      isLocationSharing,
      networkName,
      isDirectoryUser,
    } = userAdditionalMeta;

    const {
      idHash,
      id,
      name,
      customName,
      starred,
      blocked,
      inactive,
      inNetwork,
      verificationStatus,
    } = userData;

    return {
      // userAdditionalMeta
      selfUser,
      hasProfilePicture,
      isGuest,
      timeIdle,
      verificationStatus,
      isBot,
      isLocationSharing,
      networkName,
      isDirectoryUser,

      // userData
      idHash,
      id,
      name,
      customName,
      starred,
      blocked,
      inactive,
      inNetwork,
    };
  }
  return undefined;
}

export function userCollectionToWickrUsers(coll: UserCollection): WickrUser[] {
  return coll.userItem.flatMap((item) => {
    const user = userItemToWickrUser(item);
    return user ? [user] : [];
  });
}

export function selectContactId(contact: WickrContact) {
  return contact.idHash;
}

export function selectUserId(user: { idHash: string }) {
  return user.idHash;
}
