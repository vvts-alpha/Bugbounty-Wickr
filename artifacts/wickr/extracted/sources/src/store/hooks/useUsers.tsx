import { useEffect, useMemo } from 'react';
import { WickrUser } from '@/lib/protobuf/users';
import { useAppDispatch, useAppSelectorExtra } from '@/store';
import {
  selectDirectoryUsersByIdHashes,
  selectUserById,
  selectUsersByIdHashes,
} from '@/store/slices/users';
import { fetchUser, fetchUserById } from '@/store/thunks/messages';
import { isNonEmptyString } from '@/utils/strings';

/**
 * Custom hook to find or fetch a user if they don't exist in the users store.
 *
 * The hook may return undefined at the first run when the user is missing,
 * but will return the fetched user later.
 *
 * @deprecated use useUser if possible
 *
 * @param {string} id The email id used to identify the user
 * @returns Wickr user if found
 */
export const useUserById = (id: string): WickrUser | undefined => {
  const dispatch = useAppDispatch();
  const user = useAppSelectorExtra(selectUserById, id);
  useEffect(() => {
    if (!user && id) {
      dispatch(fetchUserById(id));
    }
  }, [user, id]);

  return user;
};

/**
 * Custom hook to find or fetch multiple users by their IDs.
 *
 * The hook may return an incomplete array at the first run when users are missing,
 * but will return all fetched users later.
 *
 * @param {string[]} ids Array of email ids used to identify the users
 * @returns Array of Wickr users (only includes found users, filters out missing ones)
 */
export const useUsersById = (ids: string[]): WickrUser[] => {
  const dispatch = useAppDispatch();
  const filteredIds = ids.filter(isNonEmptyString);
  const allUsers = useAppSelectorExtra((state) => Object.values(state.users.all));

  const users = useMemo(() => {
    return filteredIds
      .map((id) => allUsers.find((user) => user.id === id))
      .filter((user): user is WickrUser => !!user);
  }, [allUsers, filteredIds]);

  useEffect(() => {
    const foundIds = new Set(users.map((user) => user.id));
    const missingIds = filteredIds.filter((id) => !foundIds.has(id));

    missingIds.forEach((id) => {
      dispatch(fetchUserById(id));
    });
  }, [users, filteredIds, dispatch]);

  return users;
};

/**
 * Custom hook to find or fetch a user if they don't exist in the users store.
 *
 * The hook may return undefined at the first run when the user is missing,
 * but will return the fetched user later.
 *
 * @param {string} idHash The id hash used to identify the user
 * @returns Wickr user if found
 */
export const useUser = (idHash: string | undefined): WickrUser | undefined => {
  return useUsers([idHash])[0];
};

/**
 * @see useUser find or fetch more than one users
 */
export const useUsers = (idHashes: (string | undefined)[]): WickrUser[] => {
  const dispatch = useAppDispatch();
  const filteredIdHashes = idHashes.filter(isNonEmptyString);
  const users = useAppSelectorExtra(selectUsersByIdHashes, filteredIdHashes);
  const directoryUsers = useAppSelectorExtra(selectDirectoryUsersByIdHashes, filteredIdHashes);
  // Fallback to using directory users if the user can't be found in contacts
  const allUsers = useMemo(() => {
    const combined = users;
    directoryUsers.map((du) => {
      if (!users.find((u) => u.idHash === du.idHash)) {
        combined.push(du);
      }
    });
    return combined;
  }, [users, directoryUsers]);

  // Fetch full contact data if it doesn't exist OR if it only exists as a directory user
  // since directory users don't have all data about a contact
  useEffect(() => {
    const missingUserIdHashes = filteredIdHashes.filter(
      (idHash) => !users.find((user) => user.idHash === idHash)
    );
    for (const idHash of missingUserIdHashes) {
      dispatch(fetchUser(idHash));
    }
  }, [users, idHashes]);

  return allUsers;
};
