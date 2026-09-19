import { setSelfAttributes } from '../slices/account';
import { upsertDirectoryUsers, upsertUsers } from '../slices/users';
import { createAppAsyncThunk } from '../utils';
import {
  ManageUserItem,
  SetCustomNamePayload,
  SetIsBlockedPayload,
  SetIsFavoritePayload,
  VerifyUserPayload,
} from '@/apis/webChannel/BridgeWebChannel';
import {
  checkUser,
  convertDirectoryUser,
  getBlockedUsers,
  getContacts,
  getDirectory,
  getVerificationFingerprint,
  searchContacts,
} from '@/apis/webFetch';
import { Logger } from '@/lib/logger';

const logger = new Logger('UsersThunk');

/**
 * Initializes the account state by fetching the self
 * account attributes from Qt, such as isAdmin.
 */
export const initAccountState = createAppAsyncThunk(
  `users/initAccountState`,
  async (_: undefined, { dispatch, extra }) => {
    const attrs = await extra.bridge.getSelfAccountAttributes();
    dispatch(setSelfAttributes(attrs));
  }
);

export const setUserAsFavorite = createAppAsyncThunk(
  `users/setUserAsFavorite`,
  async (payload: SetIsFavoritePayload, { extra }) => {
    await extra.bridge.setUserAsFavorite(payload);
  }
);

export const setUserIsBlocked = createAppAsyncThunk(
  `users/setUserIsBlocked`,
  async (payload: SetIsBlockedPayload, { extra }) => {
    await extra.bridge.setUserIsBlocked(payload);
  }
);

export const setUserCustomName = createAppAsyncThunk(
  `users/setUserCustomName`,
  async (payload: SetCustomNamePayload, { extra }) => {
    return extra.bridge.setUserCustomName(payload);
  }
);

export const fetchBlockedUsers = createAppAsyncThunk(
  `users/fetchBlockedUsers`,
  async (_: undefined, { dispatch }) => {
    const fetchedUsers = await getBlockedUsers();
    dispatch(upsertUsers(fetchedUsers));
  }
);

export const verifyUser = createAppAsyncThunk(
  `users/verifyUser`,
  async (payload: VerifyUserPayload, { extra }) => {
    return extra.bridge.verifyUser(payload);
  }
);

export type VerificationFingerprint = {
  /** String to be encoded in the QR code, eg. "0BYTCVQXC7RCDN3WZBYJKDQN6SR8R4G ... A10EG" */
  qrFingerPrint: string;
  /** Security code string to manually verify, eg. "BYTC VQXC 7RCD N3WZ ... M5DG 7WR" */
  securityCode: string;
};

export const fetchUserVerificationFingerprint = createAppAsyncThunk(
  `users/fetchUserVerificationFingerprint`,
  async (userId: string) => {
    return getVerificationFingerprint(userId);
  }
);

export const updateContacts = createAppAsyncThunk(
  `users/updateContacts`,
  async (_: undefined, { dispatch }) => {
    const fetchedUsers = await getContacts();
    dispatch(upsertUsers(fetchedUsers));
  }
);

export const searchContactsAndDirectory = createAppAsyncThunk(
  `users/searchContacts`,
  async (searchQuery: string, { dispatch }) => {
    const fetchedUsers = await searchContacts(searchQuery);
    dispatch(upsertUsers(fetchedUsers));
    return fetchedUsers;
  }
);

/** Fetches paginated directory users. Page starts at 1. */
export const getDirectoryPage = createAppAsyncThunk(
  `users/getDirectoryPage`,
  async (page: number, { dispatch }) => {
    const fetchedUsers = await getDirectory(page);
    logger.info(`users/getDirectoryPage: Page ${page} - fetched ${fetchedUsers.length} users`);
    dispatch(upsertDirectoryUsers(fetchedUsers));
    return fetchedUsers;
  }
);

export const convertDirectoryUserToContact = createAppAsyncThunk(
  `users/convertDirectoryUserToContact`,
  async ({ userId, userHash }: { userId: string; userHash: string }) => {
    const { status } = await convertDirectoryUser(userId, userHash);
    logger.info(
      `users/convertDirectoryUserToContact: Convert idHash ${userHash} status: ${status}`
    );
    return status;
  }
);

/** Checks if a user validation call is needed for the user.
 * Used when searching contacts/directory. */
export const checkUserValidation = createAppAsyncThunk(
  `users/checkUser`,
  async (searchQuery: string) => {
    if (searchQuery.trim().length === 0) return;
    await checkUser(searchQuery);
  }
);

/** Clears locally stored directory information on the QT side.
 * This allows fresh data to be fetched when calling
 * `getDirectoryPage`.
 */
export const resetDirectory = createAppAsyncThunk(
  `users/resetDirectory`,
  async (_: undefined, { extra }) => {
    logger.info('users/resetDirectory');
    extra.bridge.resetDirectory();
  }
);

export const getUsersToManage = createAppAsyncThunk(
  `useres/getUsersToManage`,
  async (_: undefined, { extra }) => {
    return await extra.bridge.getUsersToManage();
  }
);

export const userActionRemove = createAppAsyncThunk(
  `useres/userActionRemove`,
  async (payload: ManageUserItem, { extra }) => {
    return extra.bridge.userActionRemove(payload);
  }
);
