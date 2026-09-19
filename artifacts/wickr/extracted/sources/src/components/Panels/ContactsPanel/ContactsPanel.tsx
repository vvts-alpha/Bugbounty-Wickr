import { clsx } from 'clsx';
import React, { FC, useEffect, useMemo, useState } from 'react';
import { useInView } from 'react-intersection-observer';
import searchNoResults from '../../images/search_no_results.png';
import {
  IconButton,
  InformationIcon,
  Panel,
  PanelBody,
  PanelHeader,
  SearchInput,
  Tabs,
  Tab,
} from '@/componentlibrary';
import { NonVirtualListItems } from '@/componentlibrary/VirtualList/NonVirtualListItems';
import { VirtualList, VirtualListProps } from '@/componentlibrary/VirtualList/VirtualList';
import { VirtualListContainer } from '@/componentlibrary/VirtualList/VirtualListContainer';
import { VirtualListItems } from '@/componentlibrary/VirtualList/VirtualListItems';
import { SpinnerIcon } from '@/componentlibrary/icons';
import { UserRow } from '@/components/UserRow';
import useContactsSearch from '@/hooks/useContactsSearch';
import useDebouncedCallback from '@/hooks/useDebouncedCallback';
import { useAppTranslation } from '@/lib/i18n';
import { WickrUser } from '@/lib/protobuf/users';
import { useAppDispatch, useAppSelector, useAppSelectorExtra } from '@/store';
import { clearOverlay } from '@/store/slices/overlay';
import {
  clearPanelStack,
  ContactsPanelArgs,
  PANEL_SIDES,
  popPanel,
  selectContactsPanelInitialTab,
  selectIsActivePanel,
} from '@/store/slices/panels';
import { selectAllDirectoryUsers, selectAllUsers } from '@/store/slices/users';
import { createDM } from '@/store/thunks/messages';
import { viewContactDetails } from '@/store/thunks/ui';
import { getDirectoryPage } from '@/store/thunks/users';
import { contactSort } from '@/utils/sort';
import { getContactSectionString, isASCII } from '@/utils/strings';

import styles from './styles.module.less';

export enum ContactsPanelTab {
  Contacts = 0,
  Directory = 1,
}

const INITIAL_DIRECTORY_PAGE = 1;
const MIN_CHARACTERS_TO_SEARCH = 3;
const MAX_USERS_DISPLAYED_IN_DIRECTORY = 100;

export const ContactsPanel: FC<ContactsPanelArgs> = ({ name, closeIcon }) => {
  const { t } = useAppTranslation();
  const side = PANEL_SIDES[name];
  const dispatch = useAppDispatch();
  const panelIsActive = useAppSelectorExtra(selectIsActivePanel, name);
  const handleOutsideClick = () => panelIsActive && dispatch(clearPanelStack());
  const initialTab = useAppSelector(selectContactsPanelInitialTab) || ContactsPanelTab.Contacts;
  const [activeTab, setActiveTab] = useState<ContactsPanelTab>(initialTab);
  const [directoryPage, setDirectoryPage] = useState(INITIAL_DIRECTORY_PAGE);
  const [isFetchingDirectory, setIsFetchingDirectory] = useState(false);
  const allContacts = useAppSelector(selectAllUsers);
  const allDirectoryUsers = useAppSelector(selectAllDirectoryUsers);
  const allDirectoryUsersSorted = useMemo(
    () => allDirectoryUsers.filter((c) => !c.selfUser).sort(contactSort),
    [allDirectoryUsers]
  );
  const allContactsWithoutDirectory = useMemo(
    () => allContacts.filter((c) => !c.isDirectoryUser && !c.selfUser),
    [allContacts]
  );
  const favoriteContacts = useMemo(
    () => allContactsWithoutDirectory.filter((c) => c.starred),

    [allContactsWithoutDirectory]
  );
  const botContacts = useMemo(
    () => allContactsWithoutDirectory.filter((c) => c.isBot && !c.starred),

    [allContactsWithoutDirectory]
  );

  useEffect(() => {
    dispatch(clearOverlay());
  }, []);

  const restOfContactsByFirstLetter: Record<string, WickrUser[]> = useMemo(() => {
    const filteredSorted = allContactsWithoutDirectory
      .filter((c) => !c.isBot && !c.starred)
      .sort(contactSort);
    const results: Record<string, WickrUser[]> = {};

    const otherLabel = t('Other');
    for (const contact of filteredSorted) {
      const sectionString = getContactSectionString(contact) ?? otherLabel;
      results[sectionString] ??= [];
      results[sectionString].push(contact);
    }

    return results;
  }, [allContactsWithoutDirectory]);

  // Search state
  const [searchInputValue, setSearchInputValue] = useState('');
  const {
    search,
    submitSearch,
    isLoading,
    isSearching,
    contactsSearchResults,
    directorySearchResults,
  } = useContactsSearch();
  const [directoryEndRef, directoryEndInView] = useInView({
    initialInView: false,
    fallbackInView: false,
  });

  // True if directory pagination is complete and all directory users have been fetched
  const [fetchedAllDirectoryUsers, setFetchedAllDirectoryUsers] = useState(false);

  const searchContacts = async () => {
    await search(searchInputValue);
  };

  const throttledSearch = useDebouncedCallback(searchContacts, 150, {
    maxWait: 500,
  });

  useEffect(() => {
    throttledSearch();
  }, [searchInputValue]);

  const handleUserClick = (user: WickrUser) => {
    dispatch(
      createDM({
        message: ' ',
        userHash: user.idHash,
        userId: user.id,
      })
    );

    dispatch(clearPanelStack());
  };

  const handleUserInfoClick = (
    ev: React.MouseEvent<HTMLButtonElement, MouseEvent>,
    user: WickrUser
  ) => {
    ev.preventDefault();
    ev.stopPropagation();

    dispatch(
      viewContactDetails({
        userId: user.id,
        userIdHash: user.idHash,
      })
    );
  };

  const fetchNextDirectoryPage = async () => {
    if (
      isFetchingDirectory ||
      fetchedAllDirectoryUsers ||
      allDirectoryUsersSorted.length >= MAX_USERS_DISPLAYED_IN_DIRECTORY
    ) {
      return;
    }

    setIsFetchingDirectory(true);
    const fetchedUsers = await dispatch(getDirectoryPage(directoryPage)).unwrap();
    setDirectoryPage((v) => v + 1);
    setIsFetchingDirectory(false);

    if (fetchedUsers.length === 0) {
      setFetchedAllDirectoryUsers(true);
    }
  };

  useEffect(() => {
    // Fetch first directory page on initial navigation to directory tab
    if (directoryPage === INITIAL_DIRECTORY_PAGE && activeTab === ContactsPanelTab.Directory) {
      fetchNextDirectoryPage();
    }
  }, [directoryPage, activeTab]);

  const vListProps: Omit<VirtualListProps<WickrUser>, 'scrollTo'> = useMemo(
    () => ({
      items: [],
      itemHeightType: 'static',
      initialItemHeight: 60,
      scrollAnchor: false,
      preloadOffset: 120,
      renderItem: (item) => (
        <UserRow
          showContextMenuItems
          hideBotTag
          member={item}
          onClick={() => handleUserClick(item)}
          trailingPopover={
            <IconButton label={t('Info')} onClick={(ev) => handleUserInfoClick(ev, item)}>
              <InformationIcon className={styles.infoIcon} />
            </IconButton>
          }
        />
      ),
      keySelector: (item, index) => `${item.id}-${index}`,
    }),
    []
  );

  const handleSelectTab = (tab: ContactsPanelTab) => {
    setActiveTab(tab);
  };

  const atLeastThreeCharactersLabel = t('Enter at least {{minChars}} characters to search', {
    minChars: MIN_CHARACTERS_TO_SEARCH,
  });

  useEffect(() => {
    if (directoryEndInView) {
      fetchNextDirectoryPage();
    }
  }, [directoryEndInView]);

  const contactsTabElements = useMemo(() => {
    return (
      <div
        className={clsx(
          {
            [styles.inactive]: activeTab !== ContactsPanelTab.Contacts,
          },
          styles.tabElements
        )}
      >
        {isSearching ? (
          <>
            {contactsSearchResults.length === 0 && (
              <div className={styles.noResults}>
                <img src={searchNoResults} />
                {t('No results found')}
              </div>
            )}
            <VirtualList
              {...vListProps}
              id="contacts-panel-contacts-search-vlist"
              items={contactsSearchResults}
            />
          </>
        ) : (
          <>
            <VirtualListContainer
              id="contacts-panel-contacts-search-vlist-view-mode"
              {...vListProps}
            >
              {favoriteContacts.length > 0 && (
                <>
                  <div className={styles.sectionHeading}>{t('Favorites')}</div>
                  <VirtualListItems {...vListProps} items={favoriteContacts} />
                </>
              )}
              {botContacts.length > 0 && (
                <>
                  <div className={styles.sectionHeading}>{t('Bots')}</div>
                  <VirtualListItems {...vListProps} items={botContacts} />
                </>
              )}
              {Object.entries(restOfContactsByFirstLetter).map(([letter, users]) => (
                <React.Fragment key={letter}>
                  <NonVirtualListItems className={styles.sectionHeadingWrapper}>
                    <div className={styles.sectionHeading}>{letter}</div>
                  </NonVirtualListItems>

                  <VirtualListItems {...vListProps} items={users} />
                </React.Fragment>
              ))}
            </VirtualListContainer>
          </>
        )}
      </div>
    );
  }, [
    activeTab,
    isSearching,
    contactsSearchResults,
    favoriteContacts,
    botContacts,
    restOfContactsByFirstLetter,
    vListProps,
  ]);

  const directoryTabElements = useMemo(() => {
    const needsMoreChars =
      isASCII(searchInputValue) &&
      searchInputValue.length > 0 &&
      searchInputValue.length < MIN_CHARACTERS_TO_SEARCH;
    const showSpinner = (isFetchingDirectory || isLoading) && !needsMoreChars;
    const showNoResults =
      !needsMoreChars && isSearching && !isLoading && directorySearchResults.length === 0;
    const showResultsList = !isLoading && !needsMoreChars;
    const showFootnote =
      !(isFetchingDirectory || isLoading || isSearching) &&
      !fetchedAllDirectoryUsers &&
      allDirectoryUsersSorted.length >= MAX_USERS_DISPLAYED_IN_DIRECTORY;

    // Always show limited users when we've hit the max, regardless of footnote state
    const displayedUsers = isSearching
      ? directorySearchResults
      : allDirectoryUsersSorted.length >= MAX_USERS_DISPLAYED_IN_DIRECTORY
      ? allDirectoryUsersSorted.slice(0, MAX_USERS_DISPLAYED_IN_DIRECTORY)
      : allDirectoryUsersSorted;

    return (
      <div
        className={clsx(
          {
            [styles.inactive]: activeTab !== ContactsPanelTab.Directory,
          },
          styles.tabElements,
          styles.directoryTabContainer
        )}
      >
        {needsMoreChars && (
          <div className={styles.noResults}>
            <img src={searchNoResults} />
            {atLeastThreeCharactersLabel}
          </div>
        )}
        {showNoResults && (
          <div className={styles.noResults}>
            <img src={searchNoResults} />
            {t('No results found')}
          </div>
        )}
        {showResultsList && (
          <div className={styles.directoryListContainer}>
            <VirtualList
              {...vListProps}
              id="contacts-panel-directory-vlist"
              items={displayedUsers}
              renderItem={(item) => (
                <UserRow
                  showContextMenuItems
                  hideBotTag
                  hideExternal
                  member={item}
                  onClick={() => handleUserClick(item)}
                />
              )}
              footer={
                showFootnote || (!isFetchingDirectory && !fetchedAllDirectoryUsers) ? (
                  <>
                    {showFootnote && (
                      <div className={styles.footnote}>
                        {t(
                          'The first {{number}} users are displayed. Use the search bar to find specific users in this network.',
                          { number: MAX_USERS_DISPLAYED_IN_DIRECTORY }
                        )}
                      </div>
                    )}
                    {!isFetchingDirectory && !fetchedAllDirectoryUsers && (
                      <div ref={directoryEndRef} />
                    )}
                  </>
                ) : undefined
              }
            />
          </div>
        )}
        {showSpinner && <SpinnerIcon size="24px" className={styles.spinner} />}
      </div>
    );
  }, [
    activeTab,
    vListProps,
    isSearching,
    directorySearchResults,
    allDirectoryUsersSorted,
    isFetchingDirectory,
    isLoading,
    fetchedAllDirectoryUsers,
  ]);

  const baseLabel = t('Search contacts and directory');
  const [ariaLabel, setAriaLabel] = useState(baseLabel);

  useEffect(() => {
    if (!searchInputValue) {
      setAriaLabel(baseLabel);
      return;
    }

    if (activeTab === ContactsPanelTab.Contacts) {
      if (!contactsSearchResults.length && searchInputValue.length < MIN_CHARACTERS_TO_SEARCH) {
        setAriaLabel(`${baseLabel} - ${atLeastThreeCharactersLabel}`);
      } else if (contactsSearchResults.length) {
        setAriaLabel(
          `${baseLabel} - ${t('{{number}} results found', {
            number: contactsSearchResults.length,
          })}`
        );
      } else {
        setAriaLabel(`${baseLabel} - ${t('No results found')}`);
      }
    } else {
      if (!directorySearchResults.length && searchInputValue.length < MIN_CHARACTERS_TO_SEARCH) {
        setAriaLabel(`${baseLabel} - ${atLeastThreeCharactersLabel}`);
      } else if (directorySearchResults.length) {
        setAriaLabel(
          `${baseLabel} - ${t('{{number}} results found', {
            number: directorySearchResults.length,
          })}`
        );
      } else {
        setAriaLabel(`${baseLabel} - ${t('No results found')}`);
      }
    }
  }, [contactsSearchResults, directorySearchResults, searchInputValue, activeTab]);

  const handleSubmitForm = (e: React.FormEvent) => {
    e.preventDefault();
    submitSearch(searchInputValue);
  };

  return (
    <Panel
      className={styles.panel}
      onClose={() => dispatch(popPanel())}
      onOutsideClick={handleOutsideClick}
      side={side}
      closeIcon={closeIcon}
    >
      <PanelHeader title={t('Contacts')} closeLabel={t('Close')}>
        <form className={styles.search} onSubmit={handleSubmitForm}>
          <SearchInput
            onChange={(e) => setSearchInputValue(e.target.value)}
            value={searchInputValue}
            placeholder={t('Search contacts and directory')}
            aria-label={ariaLabel}
          />
        </form>
      </PanelHeader>
      <Tabs
        selectedLabel={t('selected')}
        className={styles.tabs}
        onSelectTab={handleSelectTab}
        activeTab={activeTab}
      >
        <Tab
          index={ContactsPanelTab.Contacts}
          className={styles.tabsButtonWrapper}
          ariaLabel={t('Contacts')}
        >
          {t('Contacts')}
        </Tab>
        <Tab
          index={ContactsPanelTab.Directory}
          className={styles.tabsButtonWrapper}
          ariaLabel={t('Directory')}
        >
          {t('Directory')}
        </Tab>
      </Tabs>
      <PanelBody className={styles.body}>
        {/* Always render both tabs to preserve scroll offset */}
        <div className={styles.list}>
          {contactsTabElements}
          {directoryTabElements}
        </div>
      </PanelBody>
    </Panel>
  );
};
