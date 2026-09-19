import { clsx } from 'clsx';
import { FC, useMemo, useReducer } from 'react';
import { Heading, IconButton, AddIcon, List, Button, CaretIcon } from '@/componentlibrary';
import { ConvoMembersModalReturnValue } from '@/components/Modals/ConvoMembersModal';
import { UserRow } from '@/components/UserRow';
import { useAppTranslation } from '@/lib/i18n';
import { WickrConvoMember } from '@/lib/protobuf/contacts';
import { isConvoRoom } from '@/lib/protobuf/convos';
import { useAppDispatch, useAppSelectorExtra } from '@/store';
import { useAbortableDispatch } from '@/store/hooks/useAbortableDispatch';
import { selectConvoModerators } from '@/store/slices/convos';
import { pushModal } from '@/store/slices/modal';
import { editConvo } from '@/store/thunks/convos';
import { openModal } from '@/store/thunks/modals';

import memberListStyles from '../ConvoDetailsPanel/styles.module.less';
import panelButtonStyles from '../buttonStyles.module.less';

const MAX_MEMBERS_TO_SHOW = 10;

export interface ConvoExpandableMembersListProps {
  /** Header label of the list */
  label: string;
  /** Whether or not to shot the + button to open the add members menu */
  showAddButton: boolean;
  /** If this list is for moderators (changes the add members menu to add/remove moderators) */
  isModeratorList?: boolean;
  /** Whether or not the entire list (including header) is visible */
  visible?: boolean;
  /** Optional subtext to display below the header label */
  subtext?: string;
  /** Members to display in the list */
  members: WickrConvoMember[];
  /** vGroupId of the convo this list belongs to */
  vGroupId: string;
}

export const ConvoExpandableMembersList: FC<ConvoExpandableMembersListProps> = ({
  label,
  showAddButton,
  isModeratorList = false,
  visible = true,
  subtext,
  members,
  vGroupId,
}) => {
  const { t } = useAppTranslation();
  const dispatch = useAppDispatch();
  const abortableDispatch = useAbortableDispatch();
  const [showAll, toggleShowAll] = useReducer((s) => !s, false);
  const convoModerators = useAppSelectorExtra(selectConvoModerators, vGroupId);
  const isRoom = isConvoRoom(vGroupId);

  const memberListItems = useMemo(
    () =>
      members
        .slice(0, showAll ? undefined : MAX_MEMBERS_TO_SHOW)
        .map((member) => (
          <UserRow
            key={member.id}
            member={member}
            showContextMenuItems={true}
            vGroupId={vGroupId}
          />
        )),
    [members, showAll, vGroupId]
  );

  const viewAllLabel = t('View All {{count}} Members', {
    count: members.length,
  });

  const handleClickAddButton = async () => {
    try {
      if (!isModeratorList) {
        dispatch(
          pushModal({
            name: 'ConvoMembersModal',
            params: {
              title: isRoom ? t('Add or Remove Members') : t('Add Members'),
              multiselect: true,
              vGroupId,
              submitButtonLabel: t('Save'),
              allowRemove: isRoom,
            },
          })
        );
        return;
      }

      const convoMembersModelResult = (await abortableDispatch(
        openModal({
          name: 'ConvoMembersModal',
          params: {
            title: t('Add or Remove Moderators'),
            multiselect: true,
            vGroupId,
            isModeratorList: true,
            submitButtonLabel: t('Save'),
          },
        })
      )) as ConvoMembersModalReturnValue | undefined;

      if (convoMembersModelResult?.members.length) {
        const addedModerators = convoMembersModelResult.members.filter(
          (idHash) => !convoModerators.find((m) => m.idHash === idHash)
        );
        const deletedModerators = convoModerators
          .filter((m) => !convoMembersModelResult.members.find((idHash) => m.idHash === idHash))
          .map((m) => m.idHash);

        if (addedModerators.length > 0 || deletedModerators.length > 0) {
          dispatch(
            editConvo({
              vgroupId: vGroupId,
              addedModerators,
              deletedModerators,
            })
          );
        }
      }
    } catch {
      // no-op
    }
  };

  if (!visible || members.length === 0) {
    return null;
  }

  return (
    <div className={memberListStyles.memberList}>
      <Heading className={memberListStyles.listHeading} level={2}>
        {label}
        {showAddButton && (
          <IconButton label={label} onClick={handleClickAddButton}>
            <AddIcon size="18px" />
          </IconButton>
        )}
      </Heading>
      {!!subtext && <div className={memberListStyles.listSubtext}>{subtext}</div>}
      <List className={memberListStyles.items}>{memberListItems}</List>
      {!showAll && members.length > MAX_MEMBERS_TO_SHOW && (
        <Button
          className={clsx(panelButtonStyles.fullWidthButton, panelButtonStyles.spaceBetween)}
          onClick={toggleShowAll}
        >
          {viewAllLabel}
          <CaretIcon direction="down" />
        </Button>
      )}
    </div>
  );
};
