import { generatePath, matchRoutes, RouteObject } from 'react-router';
import { joinPath } from '@/utils/path';
import { isQt } from '@/utils/platform';
import { PaginatedMessagesPayload } from '.';

const WICKR_WEB_PROD_BASENAME = 'wickrweb://';
const WICKR_WEB_DEV_BROWSER_BASENAME = 'https://localhost:8080/_/';

export const WICKR_WEB_BASENAME =
  __DEV__ && !isQt() ? WICKR_WEB_DEV_BROWSER_BASENAME : WICKR_WEB_PROD_BASENAME;

/** Routes that react-router can parse */
export const fetchRoutes = {
  convo: { id: 'convo', path: '/convo/:convoId' },
  convoList: { id: 'convoList', path: '/convolist/:convoId' },
  convoUsers: { id: 'convoUsers', path: '/convo/:convoId/members' },
  messages: { id: 'messages', path: '/message/:convoId' },
  message: { id: 'message', path: '/message/:convoId/:msgId' },
  paginatedMessages: { id: 'paginatedMessages', path: '/message/:convoId/:msgId/:before/:after' },
  reactToMessage: { id: 'reactToMessage', path: '/message/:convoId/:msgId/react/:emoji' },
  selfUser: { id: 'selfUser', path: '/users/self' },
  userHash: { id: 'userHash', path: '/users/idHash/:userHash' },
  userId: { id: 'userId', path: '/users/id/:userId' },
  userAvatarImage: { id: 'userAvatarImage', path: '/image/user/:userId' },
  userAvatarImageByUserId: { id: 'avatarImageByUserId', path: '/image/userId/:userId' },
  blockedUsers: { id: 'blockedUsers', path: '/users/blocked' },
  messageImage: { id: 'messageImage', path: '/image/message/:convoId/:msgId' },
  messageAudio: { id: 'messageAudio', path: '/audio/message/:convoId/:msgId' },
  fileData: { id: 'fileData', path: '/file/message/:convoId/:msgId' },
  fileDataFromFileManager: { id: 'fileDataFromFileManager', path: '/file/savedfile/:guid' },
  fileManagerRootFolder: { id: 'fileManagerRootFolder', path: '/filemanager/:convoId' },
  fileManagerLegacySavedItems: {
    id: 'fileManagerLegacySavedItems',
    path: '/filemanager/:convoId/legacysaveditems',
  },
  fileManagerSavedLinks: {
    id: 'fileManagerSavedLinks',
    path: '/filemanager/:convoId/savedlinks',
  },
  fileManagerFolder: { id: 'fileManagerFolder', path: '/filemanager/:convoId/:folderId' },
  fileManagerFolderFromFile: {
    id: 'fileManagerFolderFromFile',
    path: '/filemanager/:convoId/file/:fileId',
  },
  activeDevices: { id: 'activeDevices', path: '/devices/active' },
  roomHistory: { id: 'roomHistory', path: '/convo/:convoId/roomHistory' },
  roomSearch: { id: 'roomSearch', path: '/search' },
  verificationFingerprint: {
    id: 'verificationFingerprint',
    path: '/verification/fingerprints/:userId',
  },
  contacts: { id: 'contacts', path: '/contacts/contacts' },
  directory: { id: 'directory', path: '/contacts/directory' },
  contactsSearch: { id: 'contactsSearch', path: '/contacts/search' },
  changePassword: { id: 'changePassword', path: '/myaccount/password' },
  convertDirectoryUser: { id: 'convertDirectoryUser', path: '/contacts/convertdirectoryuser' },
  leaveNetwork: { id: 'leaveNetwork', path: '/myaccount/leavenetwork' },
  adminControls: { id: 'adminControls', path: '/admin/controls' },
  inviteUser: { id: 'inviteUser', path: '/admin/inviteuser' },
  checkUser: { id: 'checkUser', path: '/contacts/checkuser' },
  awsCredentials: { id: 'awsCredentials', path: '/awsCredentials' },
  getTdfTags: { id: 'getTdfTags', path: '/convo/getTdfTags' },
} as const satisfies { [id: string]: RouteObject };

export const matchWickrWebRoute = matchRoutes.bind(null, Object.values(fetchRoutes));

export const generateWickrWebPath = (path: string, params?: AnyObject) =>
  joinPath(WICKR_WEB_BASENAME, generatePath(path, params));

export const wickrWebEndpoints = {
  convo: (convoId: string) => generateWickrWebPath(fetchRoutes.convo.path, { convoId }),
  convoList: (convoId = '') => generateWickrWebPath(fetchRoutes.convoList.path, { convoId }),
  convoUsers: (convoId: string) => generateWickrWebPath(fetchRoutes.convoUsers.path, { convoId }),
  messages: (convoId: string) => generateWickrWebPath(fetchRoutes.messages.path, { convoId }),
  message: (convoId: string, msgId: string) =>
    generateWickrWebPath(fetchRoutes.message.path, { convoId, msgId }),
  paginatedMessages: ({ vGroupID, msgId, before, after }: PaginatedMessagesPayload) =>
    generateWickrWebPath(fetchRoutes.paginatedMessages.path, {
      convoId: vGroupID,
      msgId,
      before: `${before}`,
      after: `${after}`,
    }),
  reactToMessage: (convoId: string, msgId: string, emoji: string) =>
    generateWickrWebPath(fetchRoutes.reactToMessage.path, { convoId, msgId, emoji }),
  selfUser: () => generateWickrWebPath(fetchRoutes.selfUser.path),
  userHash: (userHash: string) => generateWickrWebPath(fetchRoutes.userHash.path, { userHash }),
  userId: (userId: string) => generateWickrWebPath(fetchRoutes.userId.path, { userId }),
  userAvatarImage: (userId: string) =>
    generateWickrWebPath(fetchRoutes.userAvatarImage.path, { userId }),
  userAvatarImageByUserId: (userId: string) =>
    generateWickrWebPath(fetchRoutes.userAvatarImageByUserId.path, { userId }),
  blockedUsers: () => generateWickrWebPath(fetchRoutes.blockedUsers.path),
  messageImage: (convoId: string, msgId: string) =>
    generateWickrWebPath(fetchRoutes.messageImage.path, { convoId, msgId }),
  messageAudio: (convoId: string, msgId: string) =>
    generateWickrWebPath(fetchRoutes.messageAudio.path, { convoId, msgId }),
  fileData: (convoId: string, msgId: string) =>
    generateWickrWebPath(fetchRoutes.fileData.path, { convoId, msgId }),
  fileDataFromFileManager: (guid: string) =>
    generateWickrWebPath(fetchRoutes.fileDataFromFileManager.path, { guid }),
  fileManagerRootFolder: (convoId: string) =>
    generateWickrWebPath(fetchRoutes.fileManagerRootFolder.path, { convoId }),
  fileManagerLegacySavedItems: (convoId: string) =>
    generateWickrWebPath(fetchRoutes.fileManagerLegacySavedItems.path, { convoId }),
  fileManagerSavedLinks: (convoId: string) =>
    generateWickrWebPath(fetchRoutes.fileManagerSavedLinks.path, { convoId }),
  fileManagerFolder: (convoId: string, folderId: string) =>
    generateWickrWebPath(fetchRoutes.fileManagerFolder.path, { convoId, folderId }),
  fileManagerFolderFromFile: (convoId: string, fileId: string) =>
    generateWickrWebPath(fetchRoutes.fileManagerFolderFromFile.path, { convoId, fileId }),
  activeDevices: () => generateWickrWebPath(fetchRoutes.activeDevices.path),
  roomHistory: (convoId: string) => generateWickrWebPath(fetchRoutes.roomHistory.path, { convoId }),
  roomSearch: () => generateWickrWebPath(fetchRoutes.roomSearch.path),
  verificationFingerprint: (userId: string) =>
    generateWickrWebPath(fetchRoutes.verificationFingerprint.path, { userId }),
  contacts: () => generateWickrWebPath(fetchRoutes.contacts.path),
  contactsSearch: () => generateWickrWebPath(fetchRoutes.contactsSearch.path),
  directory: () => generateWickrWebPath(fetchRoutes.directory.path),
  changePassword: () => generateWickrWebPath(fetchRoutes.changePassword.path),
  convertDirectoryUser: () => generateWickrWebPath(fetchRoutes.convertDirectoryUser.path),
  leaveNetwork: () => generateWickrWebPath(fetchRoutes.leaveNetwork.path),
  adminControls: () => generateWickrWebPath(fetchRoutes.adminControls.path),
  inviteUser: () => generateWickrWebPath(fetchRoutes.inviteUser.path),
  checkUser: () => generateWickrWebPath(fetchRoutes.checkUser.path),
  getAwsCredentials: () => generateWickrWebPath(fetchRoutes.awsCredentials.path),
  getTdfTags: () => generateWickrWebPath(fetchRoutes.getTdfTags.path),
};
