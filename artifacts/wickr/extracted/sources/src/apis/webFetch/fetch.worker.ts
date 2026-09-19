import { createSimpleAsyncWorkerHandler } from '@amzn/async-utils';
import { minutesToMilliseconds } from 'date-fns';
import { Logger } from '@/lib/logger';
import { ConsoleLogger } from '@/lib/logger/ConsoleLogger';
import { NoOpLogger } from '@/lib/logger/NoOpLogger';
import { metrics } from '@/lib/metrics';
import { durationOnly } from '@/lib/metrics/metricsHandler';
import { safeInterval } from '@/utils/safeInterval';
import { redactInProd } from '@/utils/strings';
import {
  adminControlsInternal,
  changePasswordInternal,
  convertDirectoryUserInternal,
  FetchWorkerMethods,
  getActiveDevicesInternal,
  getBlockedUsersInternal,
  getContactsInternal,
  getConvoAndUsersInternal,
  getConvoListItemsInternal,
  getConvoUsersInternal,
  getDirectoryInternal,
  getFolderFromFileInternal,
  getFolderInternal,
  getLegacySavedItemsInternal,
  getMessageInternal,
  getMessagesInternal,
  getPaginatedMessagesInternal,
  getRoomHistoryListItemsInternal,
  getRoomSearchItemsInternal,
  getRootFolderInternal,
  getSavedLinksInternal,
  getSelfUserInternal,
  getUserByIdInternal,
  getUserInternal,
  getVerificationFingerprintInternal,
  inviteUserInternal,
  checkUserInternal,
  leaveNetworkInternal,
  reactToMessageInternal,
  searchContactsInternal,
  FetchWorkerContext,
  getAwsCredentialsInternal,
  getTdfTagsInternal,
} from './fetchInternal';

const logger = new Logger('FetchWorker:Worker');

function withMetrics<T extends Record<string, AnyFunction>>(fnMap: T): T {
  const withMetricsMap: T = { ...fnMap };
  for (const key in withMetricsMap) {
    withMetricsMap[key] = metrics.timeFunction(key as any, withMetricsMap[key]);
  }
  return withMetricsMap;
}

/** The worker context as supplied via setContext. Initial values. */
const workerContext: FetchWorkerContext = {
  isAlpha: false,
  isBeta: false,
  isEnterprise: false,
  isGovCloudEnabled: false,
  isPro: false,
  isProduction: true,
};

const handler = createSimpleAsyncWorkerHandler<FetchWorkerMethods>(
  {
    setContext(ctx) {
      Object.assign(workerContext, ctx);
      if (ctx.isProduction) {
        // no-op logger and metrics
        Logger.setDefaultTransport(new NoOpLogger());
        metrics.setAddMetricsHandler(() => {});
      } else {
        // console logger and metrics (no metrics sent)
        Logger.setDefaultTransport(new ConsoleLogger());
        const metricsLogger = new Logger('metrics:worker');
        metrics.setAddMetricsHandler((metric, details) => {
          metricsLogger.info(metric, durationOnly(details), redactInProd(details, ''));
        });
      }
    },
    ...withMetrics({
      getConvoAndUsers: getConvoAndUsersInternal,
      getConvoListItems: getConvoListItemsInternal,
      getMessages: getMessagesInternal,
      getMessage: getMessageInternal,
      getPaginatedMessages: getPaginatedMessagesInternal,
      reactToMessage: reactToMessageInternal,
      getSelfUser: getSelfUserInternal,
      getUser: getUserInternal,
      getUserById: getUserByIdInternal,
      getConvoUsers: getConvoUsersInternal,
      getBlockedUsers: getBlockedUsersInternal,
      getRootFolder: getRootFolderInternal,
      getLegacySavedItems: getLegacySavedItemsInternal,
      getSavedLinks: getSavedLinksInternal,
      getFolder: getFolderInternal,
      getFolderFromFile: getFolderFromFileInternal,
      getActiveDevices: getActiveDevicesInternal,
      getRoomHistoryListItems: getRoomHistoryListItemsInternal,
      getVerificationFingerprint: getVerificationFingerprintInternal,
      getContacts: getContactsInternal,
      searchContacts: searchContactsInternal,
      getDirectory: getDirectoryInternal,
      changePassword: changePasswordInternal,
      convertDirectoryUser: convertDirectoryUserInternal,
      leaveNetwork: leaveNetworkInternal,
      getRoomSearchItems: getRoomSearchItemsInternal,
      adminControls: adminControlsInternal,
      inviteUser: inviteUserInternal,
      checkUser: checkUserInternal,
      getAwsCredentials: getAwsCredentialsInternal,
      getTdfTags: getTdfTagsInternal,
    }),
  },
  {
    onError(event) {
      logger.error('worker fatal error; terminating:', event);
    },
    onMessageError(event) {
      logger.error('worker message error:', event);
    },
  }
);

let prevStats: any;
safeInterval(() => {
  const stats = handler.getStats();
  if (JSON.stringify(stats) !== JSON.stringify(prevStats)) {
    logger.info('stats:', stats);
    prevStats = stats;
  }
}, minutesToMilliseconds(15));

export default {};
