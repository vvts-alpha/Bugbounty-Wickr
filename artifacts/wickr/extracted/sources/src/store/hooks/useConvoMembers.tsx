import { useMemo } from 'react';
import { WickrConvoMember } from '@/lib/protobuf/contacts';
import { useAppSelectorExtra } from '@/store';
import { selectConvoMembersByIdHashes } from '@/store/slices/convos';
import { isNonEmptyString } from '@/utils/strings';
import { useUsers } from './useUsers';

/**
 * Custom hook for find or fetch a conversation member, it only fetches if the id hash is not found in
 * convo members and global contacts cache
 *
 * That means, the hook may return undefined at the first run when the member is missing,
 * but will return fetched member later.
 *
 * @param {string} idHash The hash id used to identify the convo member or contact, not id
 * @returns Convo member if found
 */
export const useConvoMember = (
  vGroupId: string,
  idHash: string | undefined
): WickrConvoMember | undefined => {
  return useConvoMembers(vGroupId, [idHash])[0];
};

/**
 * @see useConvoMember find or fetch more than one convo members
 */
export const useConvoMembers = (
  vGroupId: string,
  idHashes: (string | undefined)[]
): WickrConvoMember[] => {
  const filteredIdHashes = idHashes.filter(isNonEmptyString);
  const convoMembers = useAppSelectorExtra(
    selectConvoMembersByIdHashes,
    vGroupId,
    filteredIdHashes
  );
  const users = useUsers(idHashes);

  const combined = useMemo(
    () =>
      filteredIdHashes
        .map(
          (idHash) =>
            convoMembers.find((member) => member.idHash === idHash) ??
            users.find((user) => user.idHash === idHash)
        )
        .filter((user): user is WickrConvoMember => !!user),
    [convoMembers, users]
  );
  return combined;
};
