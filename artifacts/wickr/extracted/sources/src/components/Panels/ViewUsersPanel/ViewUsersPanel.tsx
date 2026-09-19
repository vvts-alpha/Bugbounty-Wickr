import { useState } from 'react';
import { Button, Heading, List, Panel, PanelBody, PanelHeader } from '@/componentlibrary';
import { UserRow } from '@/components/UserRow';
import { useAppTranslation } from '@/lib/i18n';
import { Logger } from '@/lib/logger';
import { WickrConvoMember } from '@/lib/protobuf/contacts';
import { useAppDispatch, useAppSelector, useAppSelectorExtra } from '@/store';
import {
  selectActiveConvoShowModeratorActions,
  selectActiveConvoUnauthorizedMembers,
} from '@/store/slices/convos';
import {
  clearPanelStack,
  PANEL_SIDES,
  PanelName,
  popPanel,
  selectIsActivePanel,
} from '@/store/slices/panels';

import { selectActiveConvoId } from '@/store/slices/shared';
import { editConvo } from '@/store/thunks/convos';
import styles from './styles.module.less';

const name: PanelName = 'ViewUsersPanel';
const logger = new Logger('ViewUsersPanel');

export const ViewUsersPanel = () => {
  const { t } = useAppTranslation();
  const dispatch = useAppDispatch();
  const convoId = useAppSelector(selectActiveConvoId);
  const isActive = useAppSelectorExtra(selectIsActivePanel, name);
  const handleOutsideClick = () => isActive && dispatch(clearPanelStack());
  const showModeratorActions = useAppSelector(selectActiveConvoShowModeratorActions);
  const unauthorizedUsers = useAppSelector(selectActiveConvoUnauthorizedMembers);
  const [selectedMemberIdHashes, setSelectedMemberIdHashes] = useState<string[]>([]);

  const handleSelectMember = (user: WickrConvoMember, selected: boolean) => {
    if (selected) {
      setSelectedMemberIdHashes([...selectedMemberIdHashes, user.idHash]);
    } else {
      setSelectedMemberIdHashes(selectedMemberIdHashes.filter((idHash) => idHash !== user.idHash));
    }
  };

  const handleRemoveSelectedMembers = () => {
    dispatch(
      editConvo({
        vgroupId: convoId,
        deletedUsers: selectedMemberIdHashes,
      })
    );
    dispatch(popPanel());
  };

  return (
    <Panel
      onClose={() => dispatch(popPanel())}
      onOutsideClick={handleOutsideClick}
      side={PANEL_SIDES[name]}
      className={styles.panel}
    >
      <PanelHeader title={t('View Users')} closeLabel={t('Close')}></PanelHeader>
      <PanelBody>
        <Heading level={3} as="h3" className={styles.header}>
          {t('Unauthorized Users')}
        </Heading>
        <p className={styles.description}>
          {t(
            'The following users no longer have the required authorization to communicate in this room. No users are able to communicate in this room until all unauthorized users are removed.'
          )}
        </p>
        <List>
          {unauthorizedUsers.map((member) => (
            <UserRow
              key={member.id}
              member={member}
              showCheck={!!showModeratorActions}
              checked={selectedMemberIdHashes.includes(member.idHash)}
              onSelectCheckbox={(checked) => handleSelectMember(member, checked)}
              readOnly={!showModeratorActions}
            />
          ))}
        </List>
      </PanelBody>
      {showModeratorActions && (
        <div className={styles.buttonRow}>
          <Button
            color="red"
            onClick={handleRemoveSelectedMembers}
            aria-disabled={selectedMemberIdHashes.length === 0}
          >
            {t('Remove from Room')}
          </Button>
        </div>
      )}
    </Panel>
  );
};

export default ViewUsersPanel;
