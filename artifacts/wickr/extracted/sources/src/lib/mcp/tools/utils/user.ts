import { AppRootState } from '@/store/models';
import { selectConvoMembers } from '@/store/slices/convos';
import { selectAllUsers } from '@/store/slices/users';
import { getContactDisplayName } from '@/utils/strings';

export function selectUserDisplayName(state: AppRootState, userIdHash: string, vGroupID?: string) {
  const allUsers = [
    ...(vGroupID ? selectConvoMembers(state, vGroupID) : []),
    ...selectAllUsers(state),
  ];
  const user = allUsers.find((u) => u.idHash === userIdHash);
  return getContactDisplayName(user);
}
