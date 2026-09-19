import { runInSeries, withRetry } from '@amzn/async-utils';
import {
  ConvoCollection,
  ConvoListCollection,
  FileCollection,
  LinkCollection,
  MessageCollection,
  UserCollection,
} from '@amzn/wickr-messaging-protocol-proto';
import head from 'lodash/head';
import { Logger } from '@/lib/logger';
import { userCollectionToWickrUsers } from '@/lib/protobuf/contacts';
import {
  convoCollectionToWickrConvosAndUsers,
  convoListCollectionToWickrConvoListItems,
} from '@/lib/protobuf/convos';
import { fileCollectionToWickrFileItems } from '@/lib/protobuf/files';
import { linkCollectionToWickrLinkItems } from '@/lib/protobuf/links';
import {
  detectDuplicatedWickrMessages,
  messageCollectionToWickrMessageCollection,
  messageItemToWickrMessage,
} from '@/lib/protobuf/messages';
import { isUserIdHash, WickrUser } from '@/lib/protobuf/users';
import { ActiveDevice } from '@/store/models';
import { RoomHistoryItem } from '@/store/slices/roomHistory';
import { SearchItem } from '@/store/slices/roomSearch';
import { SettingsState } from '@/store/slices/settings';
import { VerificationFingerprint } from '@/store/thunks/users';
import { PrefixedError } from '@/utils/error';
import { responseToJson, responseToUint8Array } from '@/utils/xhr';
import { wickrWebEndpoints } from './endpoints';
import { LeaveNetworkResponse } from '.';

const logger = new Logger('webFetch');

export type FetchWorkerMethodNames =
  | 'getConvoAndUsers'
  | 'getConvoListItems'
  | 'getMessages'
  | 'getMessage'
  | 'getPaginatedMessages'
  | 'reactToMessage'
  | 'getSelfUser'
  | 'getUser'
  | 'getUserById'
  | 'getConvoUsers'
  | 'getBlockedUsers'
  | 'getRootFolder'
  | 'getLegacySavedItems'
  | 'getSavedLinks'
  | 'getFolderFromFile'
  | 'getFolder'
  | 'getActiveDevices'
  | 'getRoomHistoryListItems'
  | 'getFolder'
  | 'getRoomSearchItems'
  | 'getVerificationFingerprint'
  | 'getContacts'
  | 'searchContacts'
  | 'getDirectory'
  | 'changePassword'
  | 'convertDirectoryUser'
  | 'leaveNetwork'
  | 'adminControls'
  | 'inviteUser'
  | 'checkUser'
  | 'getAwsCredentials'
  | 'getTdfTags';

export type FetchWorkerContext = Pick<
  SettingsState,
  'isAlpha' | 'isBeta' | 'isEnterprise' | 'isGovCloudEnabled' | 'isPro' | 'isProduction'
>;

export type FetchWorkerMethods = {
  getConvoAndUsers: typeof getConvoAndUsersInternal;
  getConvoListItems: typeof getConvoListItemsInternal;
  getMessages: typeof getMessagesInternal;
  getMessage: typeof getMessageInternal;
  getPaginatedMessages: typeof getPaginatedMessagesInternal;
  reactToMessage: typeof reactToMessageInternal;
  getSelfUser: typeof getSelfUserInternal;
  getUser: typeof getUserInternal;
  getUserById: typeof getUserByIdInternal;
  getConvoUsers: typeof getConvoUsersInternal;
  getBlockedUsers: typeof getBlockedUsersInternal;
  getRootFolder: typeof getRootFolderInternal;
  getLegacySavedItems: typeof getLegacySavedItemsInternal;
  getSavedLinks: typeof getSavedLinksInternal;
  getFolder: typeof getFolderInternal;
  getFolderFromFile: typeof getFolderFromFileInternal;
  getActiveDevices: typeof getActiveDevicesInternal;
  getRoomHistoryListItems: typeof getRoomHistoryListItemsInternal;
  getVerificationFingerprint: typeof getVerificationFingerprintInternal;
  getContacts: typeof getContactsInternal;
  searchContacts: typeof searchContactsInternal;
  getDirectory: typeof getDirectoryInternal;
  changePassword: typeof changePasswordInternal;
  convertDirectoryUser: typeof convertDirectoryUserInternal;
  leaveNetwork: typeof leaveNetworkInternal;
  getRoomSearchItems: typeof getRoomSearchItemsInternal;
  adminControls: typeof adminControlsInternal;
  inviteUser: typeof inviteUserInternal;
  checkUser: typeof checkUserInternal;
  setContext: (context: FetchWorkerContext) => void;
  getAwsCredentials: typeof getAwsCredentialsInternal;
  getTdfTags: typeof getTdfTagsInternal;
};

/** re-throw any promise errors with a prefix message for easier tracing */
const prefixError = (prefix: string) => (error: any) => {
  throw new PrefixedError(`${prefix}: `, error);
};

const DEV_TIMEOUT_WARNING_MS = 5000;

const appFetch: typeof fetch = __DEV__
  ? (...args) => {
      const res = fetch(...args);
      const timer = setTimeout(() => {
        console.warn(`xhrGet took longer than ${DEV_TIMEOUT_WARNING_MS}ms; url: "${args[0]}"`);
      }, DEV_TIMEOUT_WARNING_MS);
      const onFulfill = () => clearTimeout(timer);
      res.then(onFulfill, onFulfill);
      return res;
    }
  : fetch;

export const getConvoAndUsersInternal = (vGroupID: string) =>
  appFetch(wickrWebEndpoints.convo(vGroupID))
    .then(responseToUint8Array)
    .then(ConvoCollection.decode)
    .then(convoCollectionToWickrConvosAndUsers)
    .then(({ convos, users }) => ({ convo: convos[0], users }))
    .catch(prefixError('getConvoAndUsers'));

export const getConvoListItemsInternal = (vGroupID = '') =>
  appFetch(wickrWebEndpoints.convoList(vGroupID))
    .then(responseToUint8Array)
    .then(ConvoListCollection.decode)
    .then(convoListCollectionToWickrConvoListItems)
    .catch(prefixError('getConvoListItems'));

export const getMessagesInternal = (vGroupID: string) =>
  appFetch(wickrWebEndpoints.messages(vGroupID))
    .then(responseToUint8Array)
    .then(MessageCollection.decode)
    .then(messageCollectionToWickrMessageCollection)
    .catch(prefixError('getMessages'));

export type PaginatedMessagesPayload = {
  vGroupID: string;
  msgId: string;
  before: number;
  after: number;
};

export const getMessageInternal = (vGroupID: string, msgId: string) =>
  appFetch(wickrWebEndpoints.message(vGroupID, msgId))
    .then(responseToUint8Array)
    .then(MessageCollection.decode)
    .then((coll) => coll.msgItem)
    .then(head)
    .then(messageItemToWickrMessage)
    .catch(prefixError('getMessage'));

export const getPaginatedMessagesInternal = withRetry(
  (payload: PaginatedMessagesPayload) =>
    appFetch(wickrWebEndpoints.paginatedMessages(payload))
      .then(responseToUint8Array)
      .then(MessageCollection.decode)
      .then(messageCollectionToWickrMessageCollection)
      .then((collection) => detectDuplicatedWickrMessages(payload, collection))
      .catch(prefixError('getPaginatedMessages')),
  {
    attempts: 3,
    retryDelay: ({ attempt }) => attempt * 200,
    beforeRetry: ({ args, error, attempt, maxAttempts }) => {
      logger.warn(`getPaginatedMessages failed attempt ${attempt}/${maxAttempts}:`, args[0]);
      logger.error(error);
    },
  }
);

export const reactToMessageInternal = (
  vGroupID: string,
  msgId: string,
  reaction: string,
  remove: boolean
): Promise<{ status: boolean }> =>
  appFetch(wickrWebEndpoints.reactToMessage(vGroupID, msgId, reaction), {
    headers: { remove: String(remove) },
  })
    .then(responseToJson)
    .catch(prefixError('reactToMessage'));

export const getSelfUserInternal = () =>
  appFetch(wickrWebEndpoints.selfUser())
    .then(responseToUint8Array)
    .then(UserCollection.decode)
    .then(userCollectionToWickrUsers)
    .then(head)
    .catch(prefixError('getSelfUser'));

export const getUserInternal = async (userIdHash: string): Promise<WickrUser | undefined> =>
  isUserIdHash(userIdHash)
    ? appFetch(wickrWebEndpoints.userHash(userIdHash))
        .then(responseToUint8Array)
        .then(UserCollection.decode)
        .then(userCollectionToWickrUsers)
        .then(head)
        .catch(prefixError('getUser'))
    : undefined;

export const getUserByIdInternal = (userId: string) =>
  appFetch(wickrWebEndpoints.userId(userId))
    .then(responseToUint8Array)
    .then(UserCollection.decode)
    .then(userCollectionToWickrUsers)
    .then(head)
    .catch(prefixError('getUserById'));

export const getConvoUsersInternal = (vGroupID: string) =>
  appFetch(wickrWebEndpoints.convoUsers(vGroupID))
    .then(responseToUint8Array)
    .then(UserCollection.decode)
    .then(userCollectionToWickrUsers)
    .catch(prefixError('getConvoUsers'));

export const getBlockedUsersInternal = () =>
  appFetch(wickrWebEndpoints.blockedUsers())
    .then(responseToUint8Array)
    .then(UserCollection.decode)
    .then(userCollectionToWickrUsers)
    .catch(prefixError('getBlockedUsers'));

export const getRootFolderInternal = (vGroupID: string) =>
  appFetch(wickrWebEndpoints.fileManagerRootFolder(vGroupID))
    .then(responseToUint8Array)
    .then(FileCollection.decode)
    .then(fileCollectionToWickrFileItems)
    .catch(prefixError('getRootFolder'));

export const getLegacySavedItemsInternal = (vGroupID: string) =>
  appFetch(wickrWebEndpoints.fileManagerLegacySavedItems(vGroupID))
    .then(responseToUint8Array)
    .then(FileCollection.decode)
    .then(fileCollectionToWickrFileItems)
    .catch(prefixError('getLegacySavedItems'));

export const getSavedLinksInternal = (vGroupID: string) =>
  appFetch(wickrWebEndpoints.fileManagerSavedLinks(vGroupID))
    .then(responseToUint8Array)
    .then(LinkCollection.decode)
    .then(linkCollectionToWickrLinkItems)
    .catch(prefixError('getSavedLinks'));

export const getFolderInternal = (vGroupID: string, folderId: string) =>
  appFetch(wickrWebEndpoints.fileManagerFolder(vGroupID, folderId))
    .then(responseToUint8Array)
    .then(FileCollection.decode)
    .then(fileCollectionToWickrFileItems)
    .catch(prefixError('getFolder'));

export const getFolderFromFileInternal = (vGroupID: string, fileId: string) =>
  appFetch(wickrWebEndpoints.fileManagerFolderFromFile(vGroupID, fileId))
    .then(responseToUint8Array)
    .then(FileCollection.decode)
    .then(fileCollectionToWickrFileItems)
    .catch(prefixError('getFolderFromFile'));

/** Fetch a file from a conversation */
export const getFileDataInternal = (vgroupId: string, fileId: string) =>
  appFetch(wickrWebEndpoints.fileData(vgroupId, fileId));

/** Fetch a file from the file manager */
export const getFileDataFromFileManagerInternal = (guid: string) =>
  appFetch(wickrWebEndpoints.fileDataFromFileManager(guid));

export const getActiveDevicesInternal = () =>
  appFetch(wickrWebEndpoints.activeDevices())
    .then(responseToJson<ActiveDevice[]>)
    .catch(prefixError('getActiveDevices'));

export const getRoomHistoryListItemsInternal = (convoId: string) =>
  appFetch(wickrWebEndpoints.roomHistory(convoId))
    .then(responseToJson<{ roomHistory: RoomHistoryItem[] }>)
    .catch(prefixError('getRoomHistoryListItems'));

export const getVerificationFingerprintInternal = (userId: string) =>
  appFetch(wickrWebEndpoints.verificationFingerprint(userId))
    .then(responseToJson<VerificationFingerprint>)
    .catch(prefixError('getVerificationFingerprints'));

export const getContactsInternal = () =>
  appFetch(wickrWebEndpoints.contacts())
    .then(responseToUint8Array)
    .then(UserCollection.decode)
    .then(userCollectionToWickrUsers)
    .catch(prefixError('getContacts'));

// contactsSearch has issues when run in parallel, so run it in series
// see: https://issues.amazon.com/Wickr-12719
export const searchContactsInternal = runInSeries((searchQuery: string) =>
  appFetch(wickrWebEndpoints.contactsSearch(), {
    headers: {
      searchQuery: encodeURIComponent(searchQuery),
    },
  })
    .then(responseToUint8Array)
    .then(UserCollection.decode)
    .then(userCollectionToWickrUsers)
    .catch(prefixError('searchContacts'))
);

export const getDirectoryInternal = (page: number) =>
  appFetch(wickrWebEndpoints.directory(), {
    headers: {
      pageNumber: page.toString(),
    },
  })
    .then(responseToUint8Array)
    .then(UserCollection.decode)
    .then(userCollectionToWickrUsers)
    .catch(prefixError('getDirectory'));

export const changePasswordInternal = (oldPassword: string, newPassword: string) =>
  appFetch(wickrWebEndpoints.changePassword(), {
    headers: {
      oldPassword: encodeURIComponent(oldPassword),
      newPassword: encodeURIComponent(newPassword),
    },
  })
    .then(responseToJson<{ status: boolean; forceLogout: boolean; errorCode: string }>)
    .catch(prefixError('changePassword'));

export const convertDirectoryUserInternal = (userId: string, userHash: string) =>
  appFetch(wickrWebEndpoints.convertDirectoryUser(), {
    headers: {
      userId, // TODO: encodeURIComponent once we have QT support
      userHash,
    },
  })
    .then(responseToJson<{ status: boolean }>)
    .catch(prefixError('convertDirectoryUser'));

export const leaveNetworkInternal = (password: string) =>
  appFetch(wickrWebEndpoints.leaveNetwork(), {
    headers: { password: encodeURIComponent(password) },
  })
    .then(responseToJson<LeaveNetworkResponse>)
    .catch(prefixError('leaveNetwork'));

export const adminControlsInternal = () =>
  appFetch(wickrWebEndpoints.adminControls())
    .then(responseToJson<{ status: boolean }>)
    .catch(prefixError('adminControls'));

export const inviteUserInternal = (email: string) =>
  appFetch(wickrWebEndpoints.inviteUser(), {
    headers: { email: encodeURIComponent(email) },
  })
    .then(responseToJson<{ status: boolean; errorType: string }>)
    .catch(prefixError('inviteUser'));

export const checkUserInternal = (searchQuery: string) =>
  appFetch(wickrWebEndpoints.checkUser(), {
    headers: { searchQuery: encodeURIComponent(searchQuery) },
  })
    .then(responseToJson<{ status: boolean; userHash?: string }>)
    .catch(prefixError('checkUser'));

export const getAwsCredentialsInternal = () =>
  appFetch(wickrWebEndpoints.getAwsCredentials())
    .then(responseToJson<{ awscredentials: any }>) // TODO: add type
    .then((value) => {
      const awsCredentials = value.awscredentials;
      awsCredentials.expiration = awsCredentials.expiration
        ? new Date(awsCredentials.expiration)
        : awsCredentials.expiration;
      return awsCredentials;
    })
    .catch(prefixError('getAwsCredentials'));

export const getTdfTagsInternal = (description: string) => {
  return appFetch(wickrWebEndpoints.getTdfTags(), {
    headers: { description: encodeURIComponent(description) },
  })
    .then(responseToJson<{ tdfTags: string[]; isSuccess: boolean }>)
    .catch(prefixError('getTdfTags'));
};
/**
 * A single api for search panel, with given filters it will return a mix
 * of different types of items match the filters
 *
 * Doc: https://quip-amazon.com/uGKZAQMwAlDV/Wickr-Search-Panel#temp:C:NYK6f5885e741ff40f3bcc02a364
 * @param query search input, return all items match this query as well as other filters, return all items match other filters when it's empty
 * @param isStarred indicates if star toggled, return only starred items that match other filters
 * @param activeTab current active tab in search panel, can be 'all' or 'files'
 * @param numConvoItems should return only {numConvoItems+1} recent rooms or convos, '+1' is used for client side to check if there are more items after,
 * when numConvoItems is -1, return all room or convo items,  return nothing when it's 0
 * @param numMessageItems refer to numConvoItems for details
 * @param numFileItems refer to numConvoItems for details
 * @param numStarredItems refer to numConvoItems for details
 * @param numSearchItems refer to numConvoItems for details
 * @param vgroupId refers to the convo id of the conversation
 * @returns A list of items, mix of FileSearchItem, MessageSearchItem, ConvoSearchItem, SearchSearchItem and StarSearchItem
 */
export const getRoomSearchItemsInternal = (
  query: string,
  isStarred: boolean,
  activeTab: string,
  numConvoItems: number,
  numMessageItems: number,
  numFileItems: number,
  numStarredItems: number,
  numSearchItems: number,
  vgroupId: string | undefined
) =>
  appFetch(wickrWebEndpoints.roomSearch(), {
    headers: {
      searchQuery: encodeURIComponent(query),
      vgroupId: String(vgroupId),
      isStarred: String(isStarred),
      activeTab,
      numConvoItems: String(numConvoItems),
      numMessageItems: String(numMessageItems),
      numFileItems: String(numFileItems),
      numStarredItems: String(numStarredItems),
      numSearchItems: String(numSearchItems),
    },
  })
    .then(responseToJson)
    .then((data): SearchItem[] => data.searchResults)
    .then((searchResults) => {
      return searchResults.map((item) => {
        if ('timestamp' in item) {
          item.timestamp *= 1000;
        }
        return item;
      });
    })
    .catch(prefixError('getRoomSearchItems'));

if (__DEV__) {
  Object.assign(globalThis, {
    _internal: {
      getConvoAndUsersInternal,
      getConvoListItemsInternal,
      getMessageInternal,
      getMessagesInternal,
      getPaginatedMessagesInternal,
      getUserInternal,
      getSelfUserInternal,
      getConvoUsersInternal,
      getRootFolderInternal,
      getLegacySavedItemsInternal,
      getSavedLinksInternal,
      getFolderInternal,
      getFolderFromFileInternal,
      getFileDataInternal,
      getFileDataFromFileManagerInternal,
      wickrWebEndpoints,
      leaveNetworkInternal,
      adminControlsInternal,
      inviteUserInternal,
    },
  });
}
