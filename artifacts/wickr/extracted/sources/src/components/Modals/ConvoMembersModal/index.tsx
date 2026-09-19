import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useAbortableDispatch } from '../../../store/hooks/useAbortableDispatch';
import searchNoResults from '../../images/search_no_results.png';
import {
  Heading,
  InformationIcon,
  Modal,
  ModalBody,
  ModalButtonGroup,
  ModalHeader,
  PrimaryButton,
} from '@/componentlibrary';
import ChipInput, { ChipItem } from '@/componentlibrary/ChipInput';
import { NonVirtualListItems } from '@/componentlibrary/VirtualList/NonVirtualListItems';
import { VirtualListContainer } from '@/componentlibrary/VirtualList/VirtualListContainer';
import {
  VirtualListItems,
  VirtualListItemsProps,
} from '@/componentlibrary/VirtualList/VirtualListItems';
import { UserRow } from '@/components/UserRow';
import useContactsSearch from '@/hooks/useContactsSearch';
import useDebouncedCallback from '@/hooks/useDebouncedCallback';
import useLatestCallback from '@/hooks/useLatestCallback';
import { useAppTranslation } from '@/lib/i18n';
import { WickrUser } from '@/lib/protobuf/users';
import { useAppDispatch, useAppSelector, useAppSelectorExtra } from '@/store';
import {
  selectConvoHasGuestUsers,
  selectConvoMemberIds,
  selectConvoMembers,
  selectConvoModerators,
} from '@/store/slices/convos';
import { selectSelfUserIdHash } from '@/store/slices/identity';
import { selectConvoMembersModalParams } from '@/store/slices/modal';
import { selectAllUsers } from '@/store/slices/users';
import { editConvo } from '@/store/thunks/convos';
import { closeModal, openAlertModal, openModal } from '@/store/thunks/modals';
import { convertDirectoryUserToContact } from '@/store/thunks/users';
import { contactSort } from '@/utils/sort';
import { getContactDisplayName, getContactSectionString } from '@/utils/strings';

import styles from './styles.module.less';

export const MAX_MEMBERS = 1000;

export type ConvoMembersModalReturnValue = {
  members: string[];
};

/** Modal for creating/adding/managing members in a convo. */
const ConvoMembersModal = () => {
  const { t } = useAppTranslation();
  const dispatch = useAppDispatch();
  const {
    title,
    multiselect,
    submitButtonLabel,
    vGroupId = '',
    backButton,
    isModeratorList,
    allowRemove = true,
    allowAdd = true,
  } = useAppSelector(selectConvoMembersModalParams);
  const selfUserIdHash = useAppSelector(selectSelfUserIdHash);
  // Current members of the convo if vGroupId is provided (initial state)
  const selfHash = useRef([selfUserIdHash]);
  const memberIdHashes = useAppSelectorExtra(selectConvoMemberIds, vGroupId) ?? selfHash.current;
  const moderators = useAppSelectorExtra(selectConvoModerators, vGroupId);
  const members = useAppSelectorExtra(selectConvoMembers, vGroupId);
  const [selectedContactIdHashes, setSelectedContactIdHashes] = useState<string[]>(
    isModeratorList ? moderators.map((m) => m.idHash) : memberIdHashes
  );
  const allContacts = useAppSelector(selectAllUsers);
  const allContactsWithoutDirectory = useMemo(
    () => allContacts.filter((c) => !c.isDirectoryUser),
    [allContacts]
  );
  const chips = useMemo<ChipItem[]>(() => {
    const filtered = allContacts
      .filter(
        (c) => selectedContactIdHashes.includes(c.idHash) && !memberIdHashes.includes(c.idHash)
      )
      .sort((a, b) =>
        selectedContactIdHashes.indexOf(a.idHash) > selectedContactIdHashes.indexOf(b.idHash)
          ? 1
          : -1
      );

    return filtered.map((c) => ({ id: c.idHash, label: getContactDisplayName(c) }));
  }, [allContacts, memberIdHashes, selectedContactIdHashes]);
  const [searchInputValue, setSearchInputValue] = useState('');
  // If it's a moderator list, search non-guest convo members
  // Otherwise, search all contacts
  const membersToSearch = useMemo(
    () =>
      isModeratorList
        ? members.filter((c) => memberIdHashes.includes(c.idHash) && !c.isGuest)
        : allContactsWithoutDirectory,
    [isModeratorList, members, memberIdHashes, allContactsWithoutDirectory]
  );
  const hasGuestUsers = useAppSelectorExtra(selectConvoHasGuestUsers, vGroupId);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const {
    search,
    submitSearch,
    isLoading,
    isSearching,
    contactsSearchResults,
    directorySearchResults,
  } = useContactsSearch();
  const allResults = useMemo(
    () => allContacts.concat(directorySearchResults),
    [allContacts, directorySearchResults]
  );

  const handleClose = () => {
    dispatch(closeModal('ConvoMembersModal'));
  };

  const handleSubmit = () => {
    if (vGroupId && !isModeratorList) {
      // Save user changes to the room directly
      const deletedUsers = memberIdHashes.filter((m) => !selectedContactIdHashes.includes(m));
      const addedUsers = selectedContactIdHashes.filter((m) => !memberIdHashes.includes(m));

      dispatch(
        editConvo({
          vgroupId: vGroupId,
          deletedUsers,
          addedUsers,
        })
      );

      handleClose();
    } else {
      const returnValue: ConvoMembersModalReturnValue = {
        members: selectedContactIdHashes,
      };
      dispatch(
        closeModal({
          name: 'ConvoMembersModal',
          returnValue,
        })
      );
    }
  };

  const abortableDispatch = useAbortableDispatch();

  const confirmAddExternalUser = async (user: WickrUser | undefined) => {
    try {
      const success = await abortableDispatch(
        openModal({
          name: 'ConfirmModal',
          params: {
            title: t('Are you sure?'),
            body: t('{{ name }} is not in your network. Do you still want to proceed?', {
              name: getContactDisplayName(user),
            }),
          },
        })
      );

      return !!success;
    } catch {
      // no-op
    }
  };

  // Called when clicking on a row and multiselect is false
  const handleClickItem = useLatestCallback(async (idHash: string) => {
    const user = allResults.find((c) => c.idHash === idHash);
    if (!user?.inNetwork) {
      const confirmed = await confirmAddExternalUser(user);
      // User cancelled adding an external member
      if (!confirmed) return;
    }

    if (user?.isDirectoryUser) {
      await dispatch(convertDirectoryUserToContact({ userId: user.id, userHash: user.idHash }));
    }

    const returnValue: ConvoMembersModalReturnValue = {
      members: [idHash],
    };

    dispatch(
      closeModal({
        name: 'ConvoMembersModal',
        returnValue,
      })
    );
  });

  // Called when clicking on a row multiselect is true
  const handleSelectItem = useLatestCallback(async (checked: boolean, idHash: string) => {
    if (checked && selectedContactIdHashes.length >= MAX_MEMBERS) {
      dispatch(
        openAlertModal({
          title: t('Limit Reached'),
          body: t(
            'The maximum number of users that may be in this conversation, including yourself, is {{ limit }}',
            {
              limit: MAX_MEMBERS,
            }
          ),
        })
      );
      return;
    }

    if (checked) {
      const user = allResults.find((c) => c.idHash === idHash);
      if (!user?.inNetwork) {
        const confirmed = await confirmAddExternalUser(user);
        // User cancelled adding an external member
        if (!confirmed) return;
      }

      setSelectedContactIdHashes([...selectedContactIdHashes, idHash]);

      if (!memberIdHashes.includes(idHash)) {
        // Clear search query and refocus search after selecting a new member
        setSearchInputValue('');
        searchInputRef.current?.focus();
      }

      if (user?.isDirectoryUser) {
        dispatch(convertDirectoryUserToContact({ userId: user.id, userHash: user.idHash }));
      }
    } else {
      setSelectedContactIdHashes(selectedContactIdHashes.filter((h) => h !== idHash));
    }
  });

  // Filter out self user when it's not multiselect (DMs)
  const selfContactDMFilter = (user: WickrUser) => multiselect || !user.selfUser;

  const convoMembers = useMemo(() => membersToSearch.sort(contactSort), [membersToSearch]);
  const favoriteContacts = useMemo(
    () => allContacts.filter((c) => c.starred).sort(contactSort),

    [allContacts]
  );
  const botContacts = useMemo(
    () => allContacts.filter((c) => c.isBot && !c.starred).sort(contactSort),

    [allContacts]
  );
  const restOfContactsByFirstLetter: Record<string, WickrUser[]> = useMemo(() => {
    const filteredSorted = allContacts
      .filter((c) => !c.isBot && !c.starred && selfContactDMFilter(c))
      .sort(contactSort);
    const results: Record<string, WickrUser[]> = {};

    const otherLabel = t('Other');
    for (const contact of filteredSorted) {
      const sectionString = getContactSectionString(contact) ?? otherLabel;
      results[sectionString] ??= [];
      results[sectionString].push(contact);
    }

    return results;
  }, [allContacts]);

  const vListItemsProps: VirtualListItemsProps<WickrUser> = useMemo(
    () => ({
      items: [],
      initialItemHeight: 58,
      itemHeightType: 'static',
      renderItem: (user) => {
        const checkDisabled =
          user.selfUser ||
          (!allowRemove && memberIdHashes.includes(user.idHash)) ||
          (!allowAdd && !memberIdHashes.includes(user.idHash));
        return (
          <UserRow
            member={user}
            vGroupId={vGroupId}
            showCheck={multiselect}
            checked={selectedContactIdHashes.includes(user.idHash) || user.selfUser}
            onSelectCheckbox={(checked) => handleSelectItem(checked, user.idHash)}
            checkDisabled={checkDisabled}
            onClick={() => handleClickItem(user.idHash)}
          />
        );
      },
      dependencies: [selectedContactIdHashes],
      keySelector: (item, index) => `${item.id}-${index}`,
    }),
    [
      allowAdd,
      allowRemove,
      vGroupId,
      multiselect,
      selectedContactIdHashes,
      memberIdHashes,
      handleClickItem,
      handleSelectItem,
    ]
  );

  const searchContacts = async () => {
    await search(searchInputValue, isModeratorList ? memberIdHashes : []);
  };

  const throttledSearch = useDebouncedCallback(searchContacts, 150, {
    maxWait: 500,
  });

  useEffect(() => {
    throttledSearch();
  }, [searchInputValue]);

  const handleRemoveChip = (idHash: string) => {
    setSelectedContactIdHashes(selectedContactIdHashes.filter((id) => id !== idHash));
  };

  const renderAllContacts = () => {
    if (isModeratorList) {
      // Moderator list shows everyone under "Contacts"
      return (
        <>
          <NonVirtualListItems className={styles.sectionHeadingWrapper}>
            <div className={styles.sectionHeading}>{t('Contacts')}</div>
          </NonVirtualListItems>
          <VirtualListItems {...vListItemsProps} items={convoMembers} />
        </>
      );
    }

    return (
      <>
        {favoriteContacts.length > 0 && (
          <>
            <NonVirtualListItems className={styles.sectionHeadingWrapper}>
              <div className={styles.sectionHeading}>{t('Favorites')}</div>
            </NonVirtualListItems>
            <VirtualListItems {...vListItemsProps} items={favoriteContacts} />
          </>
        )}
        {botContacts.length > 0 && (
          <>
            <NonVirtualListItems className={styles.sectionHeadingWrapper}>
              <div className={styles.sectionHeading}>{t('Bots')}</div>
            </NonVirtualListItems>

            <VirtualListItems {...vListItemsProps} items={botContacts} />
          </>
        )}
        {Object.entries(restOfContactsByFirstLetter).map(([letter, users]) => (
          <React.Fragment key={letter}>
            <NonVirtualListItems className={styles.sectionHeadingWrapper}>
              <div className={styles.sectionHeading}>{letter}</div>
            </NonVirtualListItems>
            <VirtualListItems {...vListItemsProps} items={users} />
          </React.Fragment>
        ))}
      </>
    );
  };

  const renderSearchResults = () => {
    const anyResultsFound = contactsSearchResults.length > 0 || directorySearchResults.length > 0;

    if (!anyResultsFound && !isLoading) {
      return (
        <div className={styles.noResults}>
          <img src={searchNoResults} />
          {t('No results found')}
        </div>
      );
    }

    return (
      <>
        {contactsSearchResults.length > 0 && (
          <>
            <NonVirtualListItems className={styles.sectionHeadingWrapper}>
              <div className={styles.sectionHeading}>{t('Contacts')}</div>
            </NonVirtualListItems>
            <VirtualListItems {...vListItemsProps} items={contactsSearchResults} />
          </>
        )}

        {directorySearchResults.length > 0 && (
          <>
            <NonVirtualListItems className={styles.sectionHeadingWrapper}>
              <div className={styles.sectionHeading}>{t('Directory')}</div>
            </NonVirtualListItems>
            <VirtualListItems {...vListItemsProps} items={directorySearchResults} />
          </>
        )}
      </>
    );
  };

  const handleSubmitForm = (e: React.FormEvent) => {
    e.preventDefault();
    isModeratorList ? searchContacts() : submitSearch(searchInputValue);
  };

  return (
    <Modal closeLabel={t('Close')} size="md" onClose={handleClose} className={styles.modal}>
      <ModalHeader backButton={backButton}>
        <div className={styles.header}>
          <Heading className={styles.heading} level={2}>
            {title}
          </Heading>
          <div className={styles.memberCount}>
            {isModeratorList ? memberIdHashes.length : selectedContactIdHashes.length}/{MAX_MEMBERS}
          </div>
        </div>
      </ModalHeader>
      <ModalBody className={styles.body}>
        <form className={styles.form} onSubmit={handleSubmitForm}>
          <ChipInput
            className={styles.input}
            inputValue={searchInputValue}
            selectedItems={chips}
            onRemoveItem={handleRemoveChip}
            onChange={setSearchInputValue}
            placeholder={t('Search contacts and directory')}
            chipRemoveLabel={t('Remove')}
            ref={searchInputRef}
          />
        </form>
        {isModeratorList && hasGuestUsers && (
          <div className={styles.guestWarning}>
            <div className={styles.infoIcon}>
              <InformationIcon size="16px" filled />
            </div>
            {t("Guests can't be moderators")}
          </div>
        )}
        <VirtualListContainer
          id="convo-members-modal-list"
          preloadOffset={150}
          className={styles.list}
        >
          {isSearching ? renderSearchResults() : renderAllContacts()}
        </VirtualListContainer>
      </ModalBody>
      {!!submitButtonLabel && (
        <ModalButtonGroup>
          <PrimaryButton className={styles.bold} onClick={handleSubmit}>
            {submitButtonLabel}
          </PrimaryButton>
        </ModalButtonGroup>
      )}
    </Modal>
  );
};

export default ConvoMembersModal;
