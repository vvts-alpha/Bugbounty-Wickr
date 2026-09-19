import { millisecondsToSeconds } from 'date-fns';
import { Logger } from '@/lib/logger';
import { ActiveDevice } from '@/store/models';
import { formatDateYYYYMMDD } from '@/utils/date';
import { setAllowedExtensions } from '@/utils/path';
import { SupportedSdkErrorsPayload } from '@/utils/sdkErrors';
import {
  AckMessageSendFailurePayload,
  ClearBotWarningPayload,
  ClearMessageTempIdPayload,
  CreateDMPayload,
  DeleteConvoPayload,
  EmojiReactMessagePayload,
  FileTransferActionPayload,
  GetBoundaryIdsPayload,
  GetConversationDetailsPayload,
  GetVgroupIdFromHashPayload,
  LeaveConvoPayload,
  MarkMessageReadPayload,
  NotNowUnverifiedUserPayload,
  PinConvoPayload,
  ReportErrorPayload,
  ResendMessagePayload,
  SendAnalyticsEventPayload,
  SendTextMessagePayload,
  SendTypingActivityPayload,
  SendVoiceMemoPayload,
  SetActiveConvoPayload,
  SetAppStateApiPayload,
  SetIsFavoritePayload,
  SetIsBlockedPayload,
  StarMessagePayload,
  TranslateMessagePayload,
  UnpinConvoPayload,
  SetCustomNamePayload,
  EditConvoPayload,
  SendAnalyticsMessagePayload,
  VerifyUserPayload,
  ChangeProfilePicturePayload,
  ChangePresencePayload,
  CreateGroupPayload,
  CreateRoomPayload,
  GetUserStatusPayload,
  SendLocationMessagePayload,
  SendEmailPayload,
  UpdateRecentSearchQueriesPayload,
  PubKeyBytesPayload,
  PushDeviceCodePayload,
  SetIsWebViewLoadedPayload,
  DeleteMessagePayload,
  ManageUserItem,
  UpdateAppPayload,
  UpdateNotificationPreferencesPayload,
  MlsActionPayload,
  ConfigureWebAppPayload,
  WebAppLoadUrlPayload,
  RemoveWebAppPayload,
  DownloadFilePayload,
  ForwardMessagePayload,
  MarkConvoAsUnreadPayload,
} from './BridgeWebChannel';
import { NetworkBanner } from './EnvironmentManagerWebChannel';
import { WebChannelAdapter } from './WebChannelAdapter';

const logger = new Logger('BridgeWebChannelAdapter');

export class BridgeWebChannelAdapter extends WebChannelAdapter<'bridge'> {
  constructor() {
    super('bridge');
  }

  // ===========================================
  // Channel methods
  // ===========================================

  sendTextMessage = async (payload: SendTextMessagePayload) => {
    const bridge = await this.whenChannel();
    return bridge.sendTextMessage(payload);
  };

  resendMessage = async (payload: ResendMessagePayload) => {
    const bridge = await this.whenChannel();
    const res = await bridge.resendMessage(payload);
    logger.info('resendMessage', payload, res);
    return res;
  };

  markMessageRead = async (payload: MarkMessageReadPayload): Promise<boolean> => {
    const bridge = await this.whenChannel();
    logger.info('markMessageRead', payload);
    if (__DEV__) {
      if (localStorage.getItem('NoMarkAsRead')) {
        return false;
      }
    }
    return bridge.markMessageRead(payload);
  };
  getQuickResponses = async () => {
    const bridge = await this.whenChannel();
    return (await bridge.getQuickResponses()).quickResponses;
  };

  starMessage = async (payload: StarMessagePayload) => {
    const bridge = await this.whenChannel();
    return bridge.starMessage(payload);
  };

  createDM = async (payload: CreateDMPayload) => {
    const bridge = await this.whenChannel();
    return bridge.createDM(payload);
  };

  createGroup = async (payload: CreateGroupPayload) => {
    const bridge = await this.whenChannel();
    return bridge.createGroup(payload);
  };

  createRoom = async (payload: CreateRoomPayload) => {
    const bridge = await this.whenChannel();
    /**
     * Convert milliseconds to seconds as the bridge method requires it,
     * but we internally work with milliseconds. Same as editConvo
     */
    payload.destructionTime = millisecondsToSeconds(payload.destructionTime);
    payload.burnOnRead = millisecondsToSeconds(payload.burnOnRead);
    return bridge.createRoom(payload);
  };

  getVgroupIdFromHash = async (payload: GetVgroupIdFromHashPayload) => {
    const bridge = await this.whenChannel();
    return bridge.getVgroupIdFromHash(payload);
  };

  emojiReact = async (payload: EmojiReactMessagePayload) => {
    const bridge = await this.whenChannel();
    return bridge.emojiReact(payload);
  };

  getBoundaryIds = async (payload: GetBoundaryIdsPayload) => {
    const bridge = await this.whenChannel();
    const ids = await bridge.getBoundaryIds(payload);
    logger.info('getBoundaryIds', payload, ids);
    return ids;
  };

  sendVoiceMemo = async (payload: SendVoiceMemoPayload) => {
    const bridge = await this.whenChannel();
    return bridge.sendVoiceMemo(payload);
  };

  sendTypingActivity = async (payload: SendTypingActivityPayload) => {
    const bridge = await this.whenChannel();
    logger.info('sendTypingActivity', payload);
    return bridge.sendTypingActivity(payload);
  };

  clearMessageTempId = async (payload: ClearMessageTempIdPayload) => {
    const bridge = await this.whenChannel();
    const value = await bridge.clearMessageTempId(payload);
    logger.info('clearMessageTempId', payload, value);
    return value;
  };

  getGoogleMapsApiInfo = async () => {
    const bridge = await this.whenChannel();
    return bridge.getGoogleMapsApiInfo();
  };

  handleStartCall = async () => {
    const bridge = await this.whenChannel();
    return bridge.handleStartCall();
  };

  sendAnalyticsEvent = async (payload: SendAnalyticsEventPayload) => {
    const bridge = await this.whenChannel();
    return bridge.sendAnalyticsEvent(payload);
  };

  sendAnalyticsMessage = async (payload: SendAnalyticsMessagePayload) => {
    const bridge = await this.whenChannel();
    return bridge.sendAnalyticsMessage(payload);
  };

  getSelfCallStatus = async () => {
    const bridge = await this.whenChannel();
    return bridge.getSelfCallStatus();
  };

  getIsCallShuttingDown = async () => {
    const bridge = await this.whenChannel();
    return bridge.getIsCallShuttingDown();
  };

  getOpenFileAllowList = async () => {
    const bridge = await this.whenChannel();
    const allowlist = (await bridge.openFileAllowList()).allowList;
    setAllowedExtensions(allowlist);
  };

  getConversationDetails = async (payload: GetConversationDetailsPayload) => {
    const bridge = await this.whenChannel();
    return bridge.getConversationDetails(payload);
  };

  ackMessageSendFailure = async (payload: AckMessageSendFailurePayload) => {
    const bridge = await this.whenChannel();
    return bridge.ackMessageSendFailure(payload);
  };

  fileTransferAction = async (payload: FileTransferActionPayload) => {
    const bridge = await this.whenChannel();
    return bridge.fileTransferAction(payload);
  };

  /** This flag is actually to check isServerReachable for the connection banner and does not check the logged in state.
   *  In most other cases, we'll want to use "clientSynchronized" flag instead. */
  isServerConnected = async () => {
    const bridge = await this.whenChannel();
    return bridge.isServerConnected();
  };

  sendRetryWOAProxy = async () => {
    const bridge = await this.whenChannel();
    return bridge.sendRetryWOAProxy();
  };

  clearBotWarning = async (payload: ClearBotWarningPayload) => {
    const bridge = await this.whenChannel();
    return bridge.clearBotWarning(payload);
  };

  setAppState = async (payload: SetAppStateApiPayload) => {
    const bridge = await this.whenChannel();
    return bridge.setAppState(payload);
  };

  translateMessage = async (payload: TranslateMessagePayload) => {
    const bridge = await this.whenChannel();
    return bridge.translateMessage(payload);
  };

  showTranslationSettings = async () => {
    const bridge = await this.whenChannel();
    return bridge.showTranslationSettings();
  };

  notNowUnverifiedUser = async (payload: NotNowUnverifiedUserPayload) => {
    const bridge = await this.whenChannel();
    return bridge.notNowUnverifiedUser(payload);
  };

  deleteConvo = async (payload: DeleteConvoPayload) => {
    const bridge = await this.whenChannel();
    return bridge.deleteConvo(payload);
  };

  pinConvo = async (payload: PinConvoPayload) => {
    const bridge = await this.whenChannel();
    return bridge.pinConvo(payload);
  };

  unpinConvo = async (payload: UnpinConvoPayload) => {
    const bridge = await this.whenChannel();
    return bridge.unpinConvo(payload);
  };

  leaveConvo = async (payload: LeaveConvoPayload) => {
    const bridge = await this.whenChannel();
    return bridge.leaveConvo(payload);
  };

  clientSynchronized = async () => {
    const bridge = await this.whenChannel();
    return bridge.clientSynchronized();
  };

  setActiveConvo = async (payload: SetActiveConvoPayload) => {
    const bridge = await this.whenChannel();
    return bridge.setActiveConvo(payload);
  };

  editConvo = async (payload: EditConvoPayload) => {
    const bridge = await this.whenChannel();

    /**
     * Convert milliseconds to seconds as the bridge method requires it,
     * but we internally work with milliseconds.
     */
    payload.destructionTime =
      typeof payload.destructionTime !== 'undefined'
        ? millisecondsToSeconds(payload.destructionTime)
        : undefined;
    payload.burnOnRead =
      typeof payload.burnOnRead !== 'undefined'
        ? millisecondsToSeconds(payload.burnOnRead)
        : undefined;

    return bridge.editConvo(payload);
  };

  reportError = async (payload: ReportErrorPayload) => {
    const bridge = await this.whenChannel();
    return bridge.reportError(payload);
  };

  clearAllUnreadConvos = async () => {
    const bridge = await this.whenChannel();
    return bridge.clearAll();
  };

  markConvoAsUnread = async (payload: MarkConvoAsUnreadPayload) => {
    const bridge = await this.whenChannel();
    return bridge.markConvoAsUnread(payload);
  };

  getSelfAccountAttributes = async () => {
    const bridge = await this.whenChannel();
    return bridge.accountAttributes();
  };

  setUserAsFavorite = async (payload: SetIsFavoritePayload) => {
    const bridge = await this.whenChannel();
    return bridge.setIsFavorite(payload);
  };

  setUserIsBlocked = async (payload: SetIsBlockedPayload) => {
    const bridge = await this.whenChannel();
    return bridge.setIsBlocked(payload);
  };

  checkForUpdates = async () => {
    const bridge = await this.whenChannel();
    return bridge.checkForUpdates();
  };

  quitApp = async () => {
    const bridge = await this.whenChannel();
    return bridge.quitApp();
  };

  signOut = async () => {
    const bridge = await this.whenChannel();
    return bridge.signOut();
  };

  setUserCustomName = async (payload: SetCustomNamePayload) => {
    const bridge = await this.whenChannel();
    return bridge.setCustomName(payload);
  };

  saveLogs = async () => {
    const bridge = await this.whenChannel();
    return bridge.saveLogs();
  };

  clearLogs = async () => {
    const bridge = await this.whenChannel();
    return bridge.clearLogs();
  };

  suspendDevice = async (payload: ActiveDevice) => {
    const bridge = await this.whenChannel();
    return bridge.suspendDevice(payload);
  };

  viewOpenSource = async () => {
    const bridge = await this.whenChannel();
    return bridge.viewOpenSource();
  };

  resetApp = async () => {
    const bridge = await this.whenChannel();
    return bridge.resetApp();
  };

  uninstallApp = async () => {
    const bridge = await this.whenChannel();
    return bridge.uninstallApp();
  };

  verifyUser = async (payload: VerifyUserPayload) => {
    const bridge = await this.whenChannel();
    return bridge.verifyUser(payload);
  };

  changeProfilePicture = async (payload?: ChangeProfilePicturePayload) => {
    const bridge = await this.whenChannel();
    return bridge.changeProfilePicture(payload);
  };

  changePresence = async (payload: ChangePresencePayload) => {
    const bridge = await this.whenChannel();
    return bridge.changePresence(payload);
  };

  isGuardEnabled = async () => {
    const bridge = await this.whenChannel();
    return bridge.isGuardEnabled();
  };

  resetDirectory = async () => {
    const bridge = await this.whenChannel();
    return bridge.resetDirectory();
  };

  getUserStatus = async (payload: GetUserStatusPayload) => {
    const bridge = await this.whenChannel();
    return bridge.getUserStatus(payload);
  };

  sendLocationMessage = async (payload: SendLocationMessagePayload) => {
    const bridge = await this.whenChannel();
    return bridge.sendLocationMessage(payload);
  };

  sendEmail = async (payload: SendEmailPayload) => {
    const bridge = await this.whenChannel();
    return bridge.sendEmail(payload);
  };

  updateRecentSearchQueries = async (payload: UpdateRecentSearchQueriesPayload) => {
    const bridge = await this.whenChannel();
    return bridge.updateRecentSearchQueries(payload);
  };

  initiateSsoTerminateAccount = async () => {
    const bridge = await this.whenChannel();
    return bridge.initiateSsoTerminateAccount();
  };

  confirmSsoTerminateAccount = async () => {
    const bridge = await this.whenChannel();
    return bridge.confirmSsoTerminateAccount();
  };

  pushDeviceQRScan = async (payload: PubKeyBytesPayload) => {
    const bridge = await this.whenChannel();
    return bridge.pushDeviceQRScan(payload);
  };

  switchToCode = async (payload: PubKeyBytesPayload) => {
    const bridge = await this.whenChannel();
    return bridge.switchToCode(payload);
  };

  pushDeviceCode = async (payload: PushDeviceCodePayload) => {
    const bridge = await this.whenChannel();
    return bridge.pushDeviceCode(payload);
  };

  setIsWebViewLoaded = async (payload: SetIsWebViewLoadedPayload) => {
    const bridge = await this.whenChannel();
    return bridge.setIsWebViewLoaded(payload);
  };

  deleteMessage = async (payload: DeleteMessagePayload) => {
    const bridge = await this.whenChannel();
    return bridge.deleteMessage(payload);
  };

  setSupportedSdkErrors = async (payload: SupportedSdkErrorsPayload) => {
    const bridge = await this.whenChannel();
    return bridge.setSupportedErrors(payload);
  };

  getProcessMetrics = async () => {
    const bridge = await this.whenChannel();
    return bridge.processMetrics();
  };

  resetProcessMetrics = async () => {
    const bridge = await this.whenChannel();
    return bridge.resetProcessMetrics();
  };

  blockATORequest = async () => {
    const bridge = await this.whenChannel();
    return bridge.blockATORequest();
  };

  getUsersToManage = async () => {
    const bridge = await this.whenChannel();
    return bridge.getUsersToManage();
  };

  userActionRemove = async (payload: ManageUserItem) => {
    const bridge = await this.whenChannel();
    return bridge.userActionRemove(payload);
  };

  updateApp = async (payload?: UpdateAppPayload) => {
    const bridge = await this.whenChannel();
    return bridge.updateApp(payload);
  };

  ignoreUpdate = async () => {
    const bridge = await this.whenChannel();
    return bridge.ignoreUpdate();
  };

  testCrashReporting = async () => {
    const bridge = await this.whenChannel();
    return bridge.testCrashReporting();
  };

  manageNotifications = async (payload: UpdateNotificationPreferencesPayload) => {
    const bridge = await this.whenChannel();
    return bridge.manageNotifications(payload);
  };

  mlsAction = async (payload: MlsActionPayload) => {
    const bridge = await this.whenChannel();
    return bridge.mlsAction(payload);
  };

  configureWebApp = async (payload: ConfigureWebAppPayload) => {
    const bridge = await this.whenChannel();
    return bridge.configureWebApp(payload);
  };

  webAppLoadUrl = async (payload: WebAppLoadUrlPayload) => {
    const bridge = await this.whenChannel();
    return bridge.webAppLoadUrl(payload);
  };

  removeWebApp = async (payload: RemoveWebAppPayload) => {
    const bridge = await this.whenChannel();
    return bridge.removeWebApp(payload);
  };

  testNetworkBanner = async (payload: Partial<NetworkBanner>) => {
    const bridge = await this.whenChannel();
    return bridge.testNetworkBanner(payload);
  };

  reauthenticateSession = async (password: string) => {
    const bridge = await this.whenChannel();
    return bridge.reauthenticateSession(password);
  };

  saveGeneralFile = async (payload: DownloadFilePayload) => {
    const bridge = await this.whenChannel();
    return bridge.saveGeneralFile(payload);
  };

  getDesktopLogsForDate = async (date: Date) => {
    const bridge = await this.whenChannel();
    return bridge.getDesktopLogsForDate(formatDateYYYYMMDD(date));
  };

  forwardMessage = async (payload: ForwardMessagePayload) => {
    const bridge = await this.whenChannel();
    return bridge.forwardMessage(payload);
  };

  isWindowFocused = async () => {
    const bridge = await this.whenChannel();
    return bridge.isWindowFocused();
  };

  updateAvailable = async () => {
    const bridge = await this.whenChannel();
    return bridge.updateAvailable();
  };

  forcedUpdateAvailable = async () => {
    const bridge = await this.whenChannel();
    return bridge.forcedUpdateAvailable();
  };

  getBrandingLinks = async () => {
    const bridge = await this.whenChannel();
    return bridge.getBrandingLinks();
  };

  getAppVersion = async () => {
    const bridge = await this.whenChannel();
    return bridge.getAppVersion();
  };

  getAppClock = async () => {
    const bridge = await this.whenChannel();
    return bridge.getAppClock();
  };

  use12HourFormat = async () => {
    const bridge = await this.whenChannel();
    return bridge.use12HourFormat();
  };

  getActiveConvoInfo = async () => {
    const bridge = await this.whenChannel();
    return bridge.getActiveConvoInfo();
  };

  getMessageUnreadCount = async () => {
    const bridge = await this.whenChannel();
    return bridge.messageUnreadCount();
  };
}
