import { createSelector } from '@reduxjs/toolkit';
import { WickrUser } from '@/lib/protobuf/users';
import { AppRootState } from '@/store/models';

const selectUsers = (state: AppRootState) => state.users;

const selectAllUsersMap = createSelector(selectUsers, (users) => users.all);

const selectAllDirectoryUsersMap = createSelector(selectUsers, (users) => users.directory);

export const selectAllUsers = createSelector(selectAllUsersMap, (usersMap) =>
  Object.values(usersMap)
);

export const selectAllDirectoryUsers = createSelector(selectAllDirectoryUsersMap, (usersMap) =>
  Object.values(usersMap)
);

/** idHash, NOT userId */
export const selectUsersByIdHashes = createSelector(
  selectAllUsersMap,
  (_: AppRootState, idHashes: string[]) => idHashes,
  (users, idHashes): WickrUser[] => {
    return idHashes.map((idHash) => users[idHash]).filter((user): user is WickrUser => !!user);
  }
);

export const selectDirectoryUsersByIdHashes = createSelector(
  selectAllDirectoryUsersMap,
  (_: AppRootState, idHashes: string[]) => idHashes,
  (users, idHashes): WickrUser[] => {
    return idHashes.map((idHash) => users[idHash]).filter((user): user is WickrUser => !!user);
  }
);

export const selectDirectoryUserByIdHash = createSelector(
  selectAllDirectoryUsersMap,
  (_: AppRootState, idHash: string) => idHash,
  (users, idHash): WickrUser | undefined => {
    return users[idHash];
  }
);

/** idHash, NOT userId */
export const selectUserByIdHash = createSelector(
  selectAllUsersMap,
  (_: AppRootState, idHash: string) => idHash,
  (users, idHash): WickrUser | undefined => {
    return users[idHash];
  }
);

/**
 * @deprecated use selectUserByIdHash if possible
 */
export const selectUserById = createSelector(
  selectAllUsers,
  (_: AppRootState, userId: string) => userId,
  (users, userId): WickrUser | undefined => {
    return users.find((user) => user.id === userId);
  }
);

export const selectBlockedUsers = createSelector(
  selectAllUsers,
  (users) => users.filter((user) => user.blocked) || []
);

export const selectAllAvatarVersionsMap = createSelector(
  selectUsers,
  (users) => users.avatarVersions
);

export const selectAvatarVersionByIdHash = createSelector(
  selectAllAvatarVersionsMap,
  (_: AppRootState, idHash: string | undefined) => idHash,
  (versionsMap, idHash) => {
    if (idHash) return versionsMap[idHash] ?? 0;
    return 0;
  }
);
