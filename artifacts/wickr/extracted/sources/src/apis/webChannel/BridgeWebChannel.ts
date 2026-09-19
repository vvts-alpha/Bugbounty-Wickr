import { MetricEvent, MetricName } from '@/lib/metrics/models';
import { ActiveDevice } from '@/store/models';
import { Brandinglinks } from '@/store/slices/settings';
import { SupportedSdkErrorsPayload, SdkErrorInfo } from '@/utils/sdkErrors';
import { NetworkBanner } from './EnvironmentManagerWebChannel';

export interface BridgeWebChannel {
  // Methods

  /** @returns The app clock, in seconds, as a string */
  getAppClock: () => Promise<number>;

  sendTextMessage: (payload: SendTextMessagePayload) => Promise<any>;

  /** @returns array of errors */
  resendMessage: (payload: ResendMessagePayload) => Promise<any[]>;

  markMessageRead: (payload: MarkMessageReadPayload) => Promise<boolean>;

  openLink: (payload: OpenLinkPayload) => Promise<any>;

  starMessage: (payload: StarMessagePayload) => Promise<any>;

  getQuickResponses: () => Promise<{ quickResponses: string[] }>;

  emojiReact: (payload: EmojiReactMessagePayload) => Promise<boolean>;

  getBoundaryIds: (payload: GetBoundaryIdsPayload) => Promise<ConvoBoundaryIds>;

  sendVoiceMemo: (payload: SendVoiceMemoPayload) => Promise<any>;

  createDM: (payload: CreateDMPayload) => Promise<any>;

  createGroup: (payload: CreateGroupPayload) => Promise<boolean>;

  createRoom: (payload: CreateRoomPayload) => Promise<boolean>;

  getVgroupIdFromHash: (payload: GetVgroupIdFromHashPayload) => Promise<string>;

  getGoogleMapsApiInfo: () => Promise<GetGoogleMapsApiInfoResult>;

  imagePreview: (payload: ImagePreviewPayload) => Promise<any>;

  clearMessageTempId: (
    payload: ClearMessageTempIdPayload
  ) => Promise<ClearMessageTempIdResponse | false>;

  handleStartCall: () => Promise<boolean>;

  isWindowFocused: () => Promise<boolean>;

  sendAnalyticsEvent: (payload: SendAnalyticsEventPayload) => Promise<boolean>;

  sendAnalyticsMessage: (payload: SendAnalyticsMessagePayload) => Promise<boolean>;

  getSelfCallStatus: () => Promise<boolean>;

  getIsCallShuttingDown: () => Promise<boolean>;

  sendTypingActivity: (payload: SendTypingActivityPayload) => Promise<void>;

  openFileAllowList: () => Promise<{ allowList: string[] }>;

  getActiveConvoInfo: () => Promise<GetActiveConvoInfoResult>;

  getConversationDetails: (
    payload: GetConversationDetailsPayload
  ) => Promise<GetConversationDetailsResult>;

  ackMessageSendFailure: (payload: AckMessageSendFailurePayload) => Promise<boolean>;

  fileTransferAction: (payload: FileTransferActionPayload) => Promise<void>;

  isServerConnected: () => Promise<boolean>;

  sendRetryWOAProxy: () => Promise<boolean>;

  clearBotWarning: (payload: ClearBotWarningPayload) => Promise<void>;

  setAppState: (payload: SetAppStateApiPayload) => Promise<void>;

  translateMessage: (payload: TranslateMessagePayload) => Promise<boolean>;

  showTranslationSettings: () => Promise<boolean>;

  /** For approving an unverified user */
  notNowUnverifiedUser: (payload: NotNowUnverifiedUserPayload) => Promise<void>;

  deleteConvo: (payload: DeleteConvoPayload) => Promise<boolean>;

  pinConvo: (payload: PinConvoPayload) => Promise<boolean>;

  unpinConvo: (payload: UnpinConvoPayload) => Promise<boolean>;

  leaveConvo: (payload: LeaveConvoPayload) => Promise<boolean>;

  setActiveConvo: (payload: SetActiveConvoPayload) => Promise<void>;

  editConvo: (payload: EditConvoPayload) => Promise<boolean>;

  /** Checks if client is synchronized with server (i.e. connected, logged-in, and message download synchonized).*/
  clientSynchronized: () => Promise<boolean>;

  /** To report error of messages that fail to send in MessageInfoPanel */
  reportError: (payload: ReportErrorPayload) => Promise<boolean>;

  clearAll: () => Promise<boolean>;

  markConvoAsUnread: (payload: MarkConvoAsUnreadPayload) => Promise<boolean>;

  accountAttributes: () => Promise<AccountAttributes>;

  setIsFavorite: (payload: SetIsFavoritePayload) => Promise<boolean>;

  setIsBlocked: (payload: SetIsBlockedPayload) => Promise<boolean>;

  setCustomName: (payload: SetCustomNamePayload) => Promise<boolean>;

  saveLogs: () => Promise<void>;

  clearLogs: () => Promise<void>;

  checkForUpdates: () => Promise<void>;

  quitApp: () => Promise<void>;

  signOut: () => Promise<void>;

  suspendDevice: (payload: ActiveDevice) => Promise<boolean>;

  getAppVersion: () => Promise<GetAppVersionResult>;

  messageUnreadCount: () => Promise<UnreadMessagesCountPayload>;

  viewOpenSource: () => Promise<void>;

  resetApp: () => Promise<void>;

  uninstallApp: () => Promise<void>;

  verifyUser: (payload: VerifyUserPayload) => Promise<void>;

  changeProfilePicture: (payload?: ChangeProfilePicturePayload) => Promise<boolean>;

  changePresence: (payload: ChangePresencePayload) => Promise<boolean>;

  isGuardEnabled: () => Promise<boolean>;

  resetDirectory: () => Promise<void>;

  getUserStatus: (payload: GetUserStatusPayload) => Promise<boolean>;

  sendLocationMessage: (payload: SendLocationMessagePayload) => Promise<boolean>;

  sendEmail: (payload: SendEmailPayload) => Promise<boolean>;

  updateRecentSearchQueries: (payload: UpdateRecentSearchQueriesPayload) => Promise<void>;

  initiateSsoTerminateAccount: () => Promise<boolean>;
  confirmSsoTerminateAccount: () => Promise<boolean>;

  pushDeviceQRScan: (payload: PubKeyBytesPayload) => Promise<boolean>;

  switchToCode: (payload: PubKeyBytesPayload) => Promise<boolean>;

  pushDeviceCode: (payload: PushDeviceCodePayload) => Promise<boolean>;

  setIsWebViewLoaded: (payload: SetIsWebViewLoadedPayload) => Promise<void>;

  deleteMessage: (payload: DeleteMessagePayload) => Promise<boolean>;

  setSupportedErrors: (payload: SupportedSdkErrorsPayload) => Promise<void>;

  processMetrics: () => Promise<processMetricsResult>;

  resetProcessMetrics: () => Promise<void>;

  blockATORequest: () => Promise<boolean>;

  getUsersToManage: () => Promise<GetUsersToManageResult>;

  userActionRemove: (payload: ManageUserItem) => Promise<boolean>;

  updateApp: (payload?: UpdateAppPayload) => Promise<boolean>;

  ignoreUpdate: () => Promise<boolean>;

  updateAvailable: () => Promise<boolean>;

  use12HourFormat: () => Promise<boolean>;

  forcedUpdateAvailable: () => Promise<boolean>;

  testCrashReporting: () => Promise<boolean>;

  getBrandingLinks: () => Promise<Brandinglinks>;

  manageNotifications: (payload: UpdateNotificationPreferencesPayload) => Promise<boolean>;

  mlsAction(payload: MlsActionPayload): Promise<void>;

  configureWebApp: (payload: ConfigureWebAppPayload) => Promise<boolean>;

  webAppLoadUrl: (payload: WebAppLoadUrlPayload) => Promise<boolean>;

  removeWebApp: (payload: RemoveWebAppPayload) => Promise<boolean>;

  testNetworkBanner: (payload: Partial<NetworkBanner>) => Promise<boolean>;

  reauthenticateSession: (password: string) => Promise<void>;

  saveGeneralFile: (payload: {
    data: string;
    filename?: string;
    mimeType?: string;
  }) => Promise<boolean>;

  getDesktopLogsForDate: (date: string) => Promise<void>;

  forwardMessage: (payload: ForwardMessagePayload) => Promise<boolean>;

  // Signals

  /** @param vGroupID */
  activeConvoChanged: QSignal<[string, string]>;

  /** @param vGroupID */
  convoAdded: QSignal<[string]>;

  /** @param vGroupID */
  convoChanged: QSignal<[string]>;

  /** @param vGroupID */
  convoDeleted: QSignal<[string]>;

  /** @param vGroupID @param tempMessageID @param messageID */
  messageAdded: QSignal<[string, string, string]>;

  /** @param vGroupID @param tempMessageID @param messageID */
  messageChanged: QSignal<[string, string, string]>;

  /** @param vGroupID @param tempMessageID @param messageID */
  messageRemoved: QSignal<[string, string, string]>;

  /** @param idHash @param changeMask */
  userChanged: QSignal<[string, number]>;

  /** @param idHash */
  userAdded: QSignal<[string]>;

  /** No params - use getQuickResponses() after this signal is emitted */
  quickResponsesChanged: QSignal<[]>;

  /** @param TypingActivities @param vGroupID */
  typingActivityChanged: QSignal<[TypingActivity[], string]>;

  windowFocusChanged: QSignal<[WindowFocusedResult]>;

  callStatusChanged: QSignal<[]>;

  isCallShuttingDownChanged: QSignal<[]>;

  fileStatusChanged: QSignal<[FileStatusChangedResult]>;

  isServerConnectedChanged: QSignal<[]>;

  sleepChanged: QSignal<[boolean]>;

  clientSynchronizedChanged: QSignal<[boolean]>;

  devicesChanged: QSignal<[DevicesChangedPayload]>;

  messageUnreadCountChanged: QSignal<[UnreadMessagesCountPayload]>;

  roomHistoryChanged: QSignal<[string]>;

  guardEnabledChanged: QSignal<[boolean]>;

  accountAttributesChanged: QSignal<[]>;

  /** @param acceptMsgBackup @param newDeviceKey @param hideRequest */
  triggerDeviceAddRequest: QSignal<[boolean, string, boolean]>;

  showDeviceSyncingScreen: QSignal<[boolean]>;

  /** @param deviceSyncVerifyKey @param supportBackup */
  switchedToCode: QSignal<[string, boolean]>;

  errorCodeEmitted: QSignal<[SdkErrorInfo]>;

  atoDeviceAddRequest: QSignal<[boolean, string]>;

  updateAvailableChanged: QSignal<[]>;

  forcedUpdateChanged: QSignal<[]>;

  brandingLinksChanged: QSignal<[]>;

  bedrockDeeplinkTriggered: QSignal<[string]>;

  reauthenticationResult: QSignal<[ReauthenticationResult]>;

  /** @param success @param content */
  logsReady: QSignal<[boolean, string]>;
}

export type SendTextMessagePayload = {
  vgroupId: string;
  message: string;
  replyTo?: string;
  edit?: string;
  mentions?: SendTextMessageMention[];
};

export type ResendMessagePayload = {
  vgroupId: string;
  messageId: string;
};

export type SendAnalyticsEventPayload = {
  event: MetricName;
};

export type SendAnalyticsMessagePayload = MetricEvent;

export type SendTextMessageMention = {
  start: number;
  stop: number;
  mentionAll: boolean;
  userId: string;
  userHash: string;
};

export type MarkMessageReadPayload = {
  vgroupId: string;
  /** In microseconds */
  timeStamp: number;
  messageId: string;
};

export type GetConversationDetailsPayload = {
  vgroupId: string;
};

export type StarMessagePayload = {
  vgroupId: string;
  messageId: string;
  star: boolean;
};

export type EmojiReactMessagePayload = {
  vgroupId: string;
  messageId: string;
  emoji: string;
  remove?: boolean;
};

export type CreateDMPayload = {
  message: string;
  userId: string;
  userHash: string;
};

export type CreateGroupPayload = {
  members: string[];
};

export type CreateRoomPayload = {
  members: string[];
  roomTitle: string;
  roomDescription: string;
  destructionTime: number;
  burnOnRead: number;
};

export type GetVgroupIdFromHashPayload = {
  otherUserHash: string;
};

export type AckMessageSendFailurePayload = {
  vgroupId: string;
  msgId: string;
};

type DeviceAddedPayload = {
  action: 'added';
  devices: ActiveDevice[];
};

type DeviceSuspendedPayload = {
  action: 'suspended';
  appId: number;
  deviceId: string;
  status: boolean;
};

export type DevicesChangedPayload = DeviceAddedPayload | DeviceSuspendedPayload;

export type UnreadMessagesCountPayload = {
  messageUnreadRoomCount: number;
  messageUnreadGroupCount: number;
  messageUnreadDMCount: number;
};

// ------------------------------------
// Bridge
// ------------------------------------

export type ClearMessageTempIdPayload = { vgroupId: string; tempMessageId: string };

export type ClearMessageTempIdResponse = { serverMessageId: string };

export type GetBoundaryIdsPayload = {
  vgroupId: string;
};

export type ConvoBoundaryIds = {
  oldestId?: string;
  oldestUnreadId?: string;
  oldestUnreadMentionId?: string;
  newestId?: string;
  newestUnackErrorId?: string;
};

export type SendVoiceMemoPayload = {
  vgroupId: string;
  audioData: string;
  /** Audio length, in milliseconds */
  recordingLength: number;
};

export type FileTransferActionPayload = {
  uuid: string;
  action: 'cancel' | 'clear';
};

export type SendTypingActivityPayload = {
  activity: 'typing' | 'voice';
};

export type TypingActivity = SendTypingActivityPayload & {
  name: string;
};

export type TranslateMessagePayload = {
  vgroupId: string;
  messageId: string;
  text: string;
};

// TODO: Will need to remove API Key from client interface once SDK supports proxying Google Maps API requests for us.
export type GetGoogleMapsApiInfoResult = {
  terrainSessionToken: string;
  satelliteSessionToken: string;
  roadmapSessionToken: string;
  hybridSessionToken: string;
  apiKey: string;
};

export enum UserChangeMaskValues {
  AvatarChange = 1,
  // Extend enum as UserChangeMask bitmask gets more types (2,4,8...)
}

export type WindowFocusedResult = {
  hasFocus: boolean;
};

export type FileStatus =
  | 'initializing'
  | 'initialized'
  | 'uploading'
  | 'uploadinterrupted'
  | 'uploadretrying'
  | 'error'
  | 'encrypting'
  | 'downloading'
  | 'canceled'
  | 'complete';
export type FileStatusTag = 'pinnedFileDownload';
export type FileStatusChangedResult = {
  status: FileStatus;
  fileName: string;
  uuid: string;
  showProgressBar: boolean;
  progress: number;
  tag?: FileStatusTag; // Optional field for additional information such as if the downloading file comes from file management
};

export type AccountAttributes = {
  allowNetworkInvites: boolean;
  isAdmin: boolean;
  isAwsNetwork: boolean;
  joinedNetworkName: string;
};

export type GetActiveConvoInfoResult = {
  vgroupId: string;
};

export type GetConversationDetailsResult = {
  conversationType: string;
  externalUsersCount: number;
  botUsersCount: number;
  membersCount: number;
  moderatorsCount: number;
  title: string;
  description: string;
  activeCall: boolean;
  unverifiedUsers: boolean;
  isModerator: boolean;
  ttl: number;
  bor: number;
  vgroupId: string;
  version: string;
  crsInfo?: string;
  crsInfoDetail?: string;
};

export type OpenLinkPayload = {
  link: string;
  showConfirmation: boolean;
};

export type ImagePreviewPayload = {
  vgroupId: string;
  messageId: string;
};

export type SavedImagePreviewPayload = {
  savedImage: string;
};

export type ClearBotWarningPayload = { vgroupId: string };

export type SetAppStateApiPayload = {
  fileManagement?: boolean;
};

export type NotNowUnverifiedUserPayload = {
  manuallyUnverified: boolean;
  userId: string;
};

export type DeleteConvoPayload = {
  vgroupId: string;
};

export type PinConvoPayload = {
  vgroupId: string;
};

export type UnpinConvoPayload = {
  vgroupId: string;
};

export type LeaveConvoPayload = {
  vgroupId: string;
};

export type SetActiveConvoPayload = {
  vgroupId: string | null;
};

export type EditConvoPayload = {
  vgroupId: string;
  addedUsers?: string[];
  deletedUsers?: string[];
  title?: string;
  description?: string;
  addedModerators?: string[];
  deletedModerators?: string[];
  /** Destruction time in seconds */
  destructionTime?: number;
  /** Burn on read time in seconds */
  burnOnRead?: number;
};

export type ReportErrorPayload = {
  msgId: string;
  vgroupId: string;
};

export type MarkConvoAsUnreadPayload = {
  vgroupId: string;
  markAsUnread: boolean;
  action: 'convoList' | 'enterConvo';
};

export type SetIsFavoritePayload = {
  userHash: string;
  favorite: boolean;
};

export type SetIsBlockedPayload = {
  userHash: string;
  block: boolean;
};

export type SetCustomNamePayload = {
  userHash: string;
  customName: string;
};

export type GetAppVersionResult = {
  version: string;
};

export type VerifyUserPayload = {
  userId: string;
  verify: boolean;
  shownCode?: string;
};

export type ChangeProfilePicturePayload = {
  remove?: boolean;
};

export type ChangePresencePayload = {
  enable: boolean;
};

export type GetUserStatusPayload = {
  userIds: string[];
};

export type SendLocationMessagePayload = {
  vgroupId: string;
  latitude: number;
  longitude: number;
};

export type SendEmailPayload = {
  to: string;
  subject: string;
  body: string;
};

export type UpdateRecentSearchQueriesPayload = {
  searchQuery: string;
};

// used for pushDeviceQRScan and switchToCode
export type PubKeyBytesPayload = {
  pubKeyBytes: string;
};

export type PushDeviceCodePayload = {
  supportBackup?: boolean;
};

export type SetIsWebViewLoadedPayload = {
  status: boolean;
};

export type DeleteMessagePayload = {
  messageId: string;
  vgroupId: string;
};
export type processMetricsResult = {
  cpu: number;
  peakCpu: number;
  memory: number;
  peakMemory: number;
};

export type ManageUserItem = {
  userHash: string;
  userId: string;
  getDisplayName: string;
  /** if they are inactive or messenger they can be removed */
  status: 'inactive' | 'unverified' | 'messenger';
};

export type GetUsersToManageResult = {
  users: ManageUserItem[];
};

// optional
export type UpdateAppPayload = {
  force?: boolean;
};

export type UpdateNotificationPreferencesPayload = {
  vgroupId: string;
  isMuted?: boolean;
  muteExpiration?: number;
  sync?: boolean;
  muteSelfMentions?: boolean;
  muteAllMentions?: boolean;
  muteCalls?: boolean;
  hideBadgeCount?: boolean;
};

export type MlsActionPayload =
  | { action: 'mlsChatResync'; vgroupId: string }
  | { action: 'mlsChatUpgrade'; vgroupId: string }
  | { action: 'mlsChatDowngrade'; vgroupId: string }
  | { action: 'mlsPrivateChatRecreate' }
  | { action: 'mlsDeleteLocalChat'; vgroupId: string }
  | { action: 'mlsServiceReset' };

export type ConfigureWebAppPayload = {
  id: string;
  visible: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
};

export type WebAppLoadUrlPayload = {
  id: string;
  url: string;
};

export type RemoveWebAppPayload = {
  id: string;
};

export type DownloadFilePayload = {
  data: string;
  filename?: string;
  mimeType?: string;
};

export type ForwardMessagePayload = {
  originalVGroupId: string;
  originalMessageId: string;
  targetVGroupId?: string;
  targetUserHashes?: string[];
  comment?: string;
  mentions?: SendTextMessageMention[];
};

export type ReauthenticationResult = {
  success: boolean;
  errorCode: number;
};
