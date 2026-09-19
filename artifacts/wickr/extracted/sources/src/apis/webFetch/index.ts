import { AsyncWorkerController } from '@amzn/async-utils';
import { Logger } from '@/lib/logger';
import { metrics } from '@/lib/metrics';
import { MetricName } from '@/lib/metrics/models';
import { fixLocalUrl } from '@/utils/url';
/** https://v3.vitejs.dev/guide/features.html#import-with-query-suffixes */
import fetchWorkerUrl from './fetch.worker.ts?worker&url';
import {
  FetchWorkerContext,
  FetchWorkerMethodNames,
  FetchWorkerMethods,
  getFileDataFromFileManagerInternal,
  getFileDataInternal,
} from './fetchInternal';

const logger = new Logger('webFetch');

function createFetchWorkerController(attempt: number) {
  const mainLogger = new Logger(`FetchWorker:Main:${attempt}`);
  const url = fixLocalUrl(fetchWorkerUrl);
  const workerController = new AsyncWorkerController<FetchWorkerMethods>({
    workerUrl: url,
    workerOptions: { type: 'module' },
    onCreateWorker() {
      mainLogger.info('worker created');
    },
    onError(event) {
      mainLogger.error('worker error', event);
      workerController.terminate('worker error');
      fetchWorkerController = createFetchWorkerController(attempt + 1);
    },
    onMessageError(event) {
      mainLogger.warn('worker message error', event);
    },
    onTerminateWorker(_, reason) {
      mainLogger.error('worker terminated', reason);
    },
  });
  if (__DEV__) {
    Object.assign(globalThis, { _fetchWorkerCtrl: workerController });
  }
  return workerController;
}

let fetchWorkerController = createFetchWorkerController(1);

/** Show verbose details during dev; report errors in production */
const createMetricDetails = !__DEV__
  ? (args: any[], res: any, err: any) => ({ args, res, err })
  : (_args: any[], _res: any, error: any) => (error ? { error: `${error}` } : {});

function createFetch<K extends FetchWorkerMethodNames, TReturns>(
  metricName: MetricName,
  workerFunctionName: K
): FetchWorkerMethods[K] {
  return metrics.timeFunction(
    metricName,
    ((...args: Parameters<FetchWorkerMethods[K]>) => {
      return fetchWorkerController.exec(workerFunctionName, args) as Promise<TReturns>;
    }) as any,
    { details: createMetricDetails }
  );
}

export const getConvoAndUsers = createFetch('GetConvo', 'getConvoAndUsers');

export const getConvoListItems = createFetch('GetConvoListItems', 'getConvoListItems');

export const getMessages = createFetch('GetMessages', 'getMessages');

export type PaginatedMessagesPayload = {
  vGroupID: string;
  msgId: string;
  before: number;
  after: number;
};

export const getMessage = createFetch('GetMessage', 'getMessage');

export const getPaginatedMessages = createFetch('GetPaginatedMessages', 'getPaginatedMessages');

export const reactToMessage = createFetch('ReactToMessage', 'reactToMessage');
export const getSelfUser = createFetch('GetUser', 'getSelfUser');

export const getUser = createFetch('GetUser', 'getUser');

export const getUserById = createFetch('GetUserById', 'getUserById');

export const getConvoUsers = createFetch('GetConvoUsers', 'getConvoUsers');

export const getBlockedUsers = createFetch('GetBlockedUsers', 'getBlockedUsers');

export const getRootFolder = createFetch('GetRootFolder', 'getRootFolder');

export const getLegacySavedItems = createFetch('GetLegacySavedItems', 'getLegacySavedItems');

export const getSavedLinks = createFetch('GetSavedLinks', 'getSavedLinks');

export const getFolder = createFetch('GetFolder', 'getFolder');

export const getFolderFromFile = createFetch('GetFolderFromFile', 'getFolderFromFile');

// We use the entire Response for getFileDataInternal/getFileDataFromFileManagerInternal, which is not transferrable, so we don't use the worker
/** Fetch a file from a convo */
export const getFileData = getFileDataInternal;

/** Fetch a file from the file manager */
export const getFileDataFromFileManager = getFileDataFromFileManagerInternal;

export const getActiveDevices = createFetch('GetActiveDevices', 'getActiveDevices');

export const getRoomHistoryListItems = createFetch(
  'GetRoomHistoryListItems',
  'getRoomHistoryListItems'
);

export const getVerificationFingerprint = createFetch(
  'GetVerificationFingerprint',
  'getVerificationFingerprint'
);

export const getContacts = createFetch('GetContacts', 'getContacts');

export const searchContacts = createFetch('SearchContacts', 'searchContacts');

export const getDirectory = createFetch('GetDirectory', 'getDirectory');

export const getRoomSearchItems = createFetch('GetRoomSearchItems', 'getRoomSearchItems');

export const convertDirectoryUser = createFetch('ConvertDirectoryUser', 'convertDirectoryUser');

export const changePassword = createFetch('ChangePassword', 'changePassword');

export type LeaveNetworkPayload = {
  password: string;
};

export type LeaveNetworkResponse = {
  status: boolean;
  errorType?: 'password' | 'admin' | 'unspecified';
};

export const leaveNetwork = createFetch('LeaveNetwork', 'leaveNetwork');

export const adminControls = createFetch('AdminControls', 'adminControls');

export const inviteUser = createFetch('InviteUser', 'inviteUser');

export const checkUser = createFetch('CheckUser', 'checkUser');

export const getAwsCredentials = createFetch('GetAwsCredentials', 'getAwsCredentials');

export const getTdfTags = createFetch('GetTdfTags', 'getTdfTags');

export function setFetchWorkerContext(ctx: FetchWorkerContext) {
  fetchWorkerController.exec('setContext', [ctx]);
}
