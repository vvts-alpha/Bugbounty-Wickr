import { clsx } from 'clsx';
import Fuse from 'fuse.js';
import { ChangeEvent, FC, useEffect, useMemo, useReducer, useState } from 'react';
import searchNoResults from '../../images/search_no_results.png';
import { CancelRemoveButtonRow } from '../CancelRemoveButtonRow';
import { Button, Panel, PanelBody, PanelHeader, SearchIcon, SearchInput } from '@/componentlibrary';
import { VirtualList } from '@/componentlibrary/VirtualList/VirtualList';
import { UserRow } from '@/components/UserRow';
import useDebouncedCallback from '@/hooks/useDebouncedCallback';
import useFuse from '@/hooks/useFuse';
import { useAppTranslation } from '@/lib/i18n';
import { WickrConvoMember } from '@/lib/protobuf/contacts';
import { WickrConvoType } from '@/lib/protobuf/convos';
import { useAppDispatch, useAppSelector, useAppSelectorExtra } from '@/store';
import {
  selectSelfUserIsModeratorInConvo,
  selectConvoMembers,
  selectConvoType,
  selectActiveConvoCanRemoveUser,
} from '@/store/slices/convos';
import { selectActiveModal } from '@/store/slices/modal';
import {
  AllConvoMembersPanelArgs,
  clearPanelStack,
  PANEL_SIDES,
  popPanel,
  selectIsActivePanel,
} from '@/store/slices/panels';
import { editConvo } from '@/store/thunks/convos';
import { contactSort } from '@/utils/sort';

import styles from './styles.module.less';
import convoDetailStyles from '../ConvoDetailsPanel/styles.module.less';

/**
 * This is a fixed height for member list item, including border and margin, measured in dev-tool
 *
 * It's good to update this value for better performance if the height of the list item changes in the future
 */
const memberListItemHeight = 60;

const fuseOptions: Fuse.IFuseOptions<WickrConvoMember> = {
  keys: ['id', 'name', 'customName'],
  isCaseSensitive: false,
  threshold: 0.2,
};

export const AllConvoMembersPanel: FC<AllConvoMembersPanelArgs> = ({
  name,
  convoId,
  closeIcon,
}) => {
  const { t } = useAppTranslation();
  const side = PANEL_SIDES[name];
  const dispatch = useAppDispatch();
  const panelIsActive = useAppSelectorExtra(selectIsActivePanel, name);
  const activeModal = useAppSelector(selectActiveModal);
  const handleOutsideClick = () => panelIsActive && !activeModal && dispatch(clearPanelStack());
  const selfUserIsModerator = useAppSelectorExtra(selectSelfUserIsModeratorInConvo, convoId);
  const canRemoveUser = useAppSelector(selectActiveConvoCanRemoveUser);
  const convoMembers = useAppSelectorExtra(selectConvoMembers, convoId);
  const convoType = useAppSelectorExtra(selectConvoType, convoId);
  const [searchInputValue, setSearchInputValue] = useState('');
  const [searchResultMemberIds, setSearchResultMemberIds] = useState<string[]>([]);
  const searchFuse = useFuse(convoMembers, fuseOptions);
  const [isSearchActive, setIsSearchActive] = useState(false);
  const [isSelectingMembers, toggleIsSelectingMembers] = useReducer((s) => !s, false);
  const [selectedMemberIdHashes, setSelectedMemberIdHashes] = useState<string[]>([]);

  const handleSelectMember = (member: WickrConvoMember, selected: boolean) => {
    if (selected) {
      setSelectedMemberIdHashes([...selectedMemberIdHashes, member.idHash]);
    } else {
      setSelectedMemberIdHashes(
        selectedMemberIdHashes.filter((idHash) => idHash !== member.idHash)
      );
    }
  };

  const filteredConvoMembers = useMemo(() => {
    const members = convoMembers
      .filter((m) => !m.isBot)
      .filter((m) => (isSearchActive ? searchResultMemberIds.includes(m.id) : true));

    return isSearchActive ? members : members.sort(contactSort);
  }, [convoMembers, searchResultMemberIds, isSearchActive]);

  const handleSearchInputChanged = (ev: ChangeEvent<HTMLInputElement>) => {
    setSearchInputValue(ev.target.value);
  };

  const searchMembers = () => {
    const trimmedInput = searchInputValue.trim();
    if (trimmedInput.length === 0) {
      setIsSearchActive(false);
      setSearchResultMemberIds([]);
      return;
    }

    const results = searchFuse.search(trimmedInput).map((result) => result.item.id);
    setSearchResultMemberIds(results);
    setIsSearchActive(true);
  };

  const throttledSearch = useDebouncedCallback(searchMembers, 150, {
    maxWait: 300,
  });

  useEffect(() => {
    throttledSearch();
  }, [searchInputValue]);

  const handleRemoveSelectedMembers = () => {
    if (selectedMemberIdHashes.length === 0) {
      handleCancelMemberSelection();
      return;
    }

    dispatch(
      editConvo({
        vgroupId: convoId,
        deletedUsers: selectedMemberIdHashes,
      })
    );
    handleCancelMemberSelection();
  };

  const handleCancelMemberSelection = () => {
    toggleIsSelectingMembers();
    setSelectedMemberIdHashes([]);
  };

  return (
    <Panel
      onClose={() => dispatch(popPanel())}
      onOutsideClick={handleOutsideClick}
      side={side}
      className={styles.panel}
      closeIcon={closeIcon}
    >
      <PanelHeader
        title={t(convoType === WickrConvoType.Room ? 'Room Members' : 'Group Members')}
        closeLabel={t('Close')}
        className={styles.header}
        trailingElement={
          canRemoveUser &&
          !isSelectingMembers && (
            <Button className={convoDetailStyles.editButton} onClick={toggleIsSelectingMembers}>
              {t('Select')}
            </Button>
          )
        }
      />
      <PanelBody className={styles.body}>
        <div className={styles.searchWrapper}>
          <SearchInput
            leadingIcon={<SearchIcon size="14px" />}
            className={styles.searchInput}
            value={searchInputValue}
            onChange={handleSearchInputChanged}
            placeholder={t('Search')}
          />
        </div>
        <div className={clsx(convoDetailStyles.memberList, styles.list)}>
          {isSearchActive && filteredConvoMembers.length === 0 && (
            <div className={styles.noResults}>
              <img src={searchNoResults} />
              {t('No results found')}
            </div>
          )}
          {filteredConvoMembers.length > 0 && (
            <VirtualList
              id="all-convo-members"
              items={filteredConvoMembers}
              keySelector={(member) => member.id}
              itemHeightType="static"
              initialItemHeight={memberListItemHeight}
              dependencies={[selfUserIsModerator, selectedMemberIdHashes, isSelectingMembers]}
              renderItem={(member) => {
                return (
                  <UserRow
                    member={member}
                    vGroupId={convoId}
                    showContextMenuItems={true}
                    showCheck={isSelectingMembers}
                    checked={selectedMemberIdHashes.includes(member.idHash)}
                    checkDisabled={member.selfUser}
                    onSelectCheckbox={(checked) => handleSelectMember(member, checked)}
                  />
                );
              }}
            />
          )}
        </div>
        {isSelectingMembers && (
          <CancelRemoveButtonRow
            onCancel={handleCancelMemberSelection}
            onRemove={handleRemoveSelectedMembers}
          />
        )}
      </PanelBody>
    </Panel>
  );
};
