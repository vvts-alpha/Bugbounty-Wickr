import { FC, useEffect, useState, ChangeEvent } from 'react';
import {
  Panel,
  PanelBody,
  PanelHeader,
  SearchInput,
  StarIcon,
  Button,
  CheckIcon,
} from '@/componentlibrary';
import Picture from '@/componentlibrary/Picture';
import { VirtualListContainer } from '@/componentlibrary/VirtualList/VirtualListContainer';
import useDebouncedCallback from '@/hooks/useDebouncedCallback';
import useLoadingState from '@/hooks/useLoadingState';
import { useAppTranslation } from '@/lib/i18n';
import { WickrConvoType } from '@/lib/protobuf/convos';
import { useAppDispatch, useAppSelector, useAppSelectorExtra } from '@/store';
import { selectActiveConvoType } from '@/store/slices/convos';
import { selectActiveModal } from '@/store/slices/modal';
import {
  clearPanelStack,
  PANEL_SIDES,
  popPanel,
  SearchPanelArgs,
  selectIsActivePanel,
  selectSearchPanelInitialStarred,
} from '@/store/slices/panels';
import {
  selectConvoSearchItems,
  selectFileSearchItems,
  selectMessageSearchItems,
  selectSearchSearchItems,
  selectStarSearchItems,
} from '@/store/slices/roomSearch';
import { resetSlice, selectActiveConvoId } from '@/store/slices/shared';
import { fetchRoomSearchItems, saveRecentSearchQuery } from '@/store/thunks/roomSearch';
import { SearchResultList } from './SearchResultList';
import noSearchResultsAll from './no-search-results-all.png';
import noSearchResultsAll2x from './no-search-results-all@2x.png';
import noSearchResultsFiles from './no-search-results-files.png';
import noSearchResultsFiles2x from './no-search-results-files@2x.png';

import styles from './styles.module.less';

const images = {
  all: {
    src: noSearchResultsAll,
    src2x: noSearchResultsAll2x,
  },
  files: {
    src: noSearchResultsFiles,
    src2x: noSearchResultsFiles2x,
  },
} as const;

export const RECENT_ITEMS_THRESHOLD = 4;
export const RECENT_SEARCHES_ITEMS_THRESHOLD = 3;

function determineFetchCount(
  isSearchAll: boolean,
  isFileList: boolean,
  isSearchEmpty: boolean,
  showAllItems: boolean,
  starred = false,
  activeConvoSearchEnabled = false
) {
  if (!isSearchAll && !isFileList) return 0; // don't fetch others items in File tab
  if (!isSearchAll && isFileList) return -1; // in File tab, fetch all files
  if (starred) return -1; // if star in search is clicked, fetch all messages and files for "show more"
  if (activeConvoSearchEnabled) return -1; // if activeConvoSearchEnabled in search is clicked, fetch all messages and files for "show more"
  if (isSearchEmpty || !showAllItems) return RECENT_ITEMS_THRESHOLD; // fetch recent items when search is empty or list is collapsed
  return -1; // fetch all items
}

export const SearchPanel: FC<SearchPanelArgs> = ({ name, closeIcon }) => {
  const { t } = useAppTranslation();
  const side = PANEL_SIDES[name];
  const dispatch = useAppDispatch();
  const panelIsActive = useAppSelectorExtra(selectIsActivePanel, name);
  const activeModal = useAppSelector(selectActiveModal);
  const handleOutsideClick = () => panelIsActive && !activeModal && dispatch(clearPanelStack());
  const initialStarred = !!useAppSelector(selectSearchPanelInitialStarred);
  const [starred, setStarred] = useState(initialStarred);
  const activeConvoId = useAppSelector(selectActiveConvoId);
  const [activeConvoSearchEnabled, setActiveConvoSearchEnabled] = useState(!!activeConvoId);
  const [searchInputValue, setSearchInputValue] = useState('');

  const [searchFiles, setSearchFiles] = useState(false); // default searching All
  const [isLoading, _hasError, setLoadingState] = useLoadingState('loading'); // TODO: bind with spinner
  const isSearchAll = !searchFiles;
  const isSearchEmpty = !searchInputValue.trim();

  const [showAllConvoItems, setShowAllConvoItems] = useState(false); // used to expand or collapse convo items list
  const [showAllMessages, setShowAllMessages] = useState(false); // used to expand or collapse messages items list
  const [showAllFiles, setShowAllFiles] = useState(!isSearchAll); // used to expand or collapse file items list

  const convoItems = useAppSelector(selectConvoSearchItems);
  const messageItems = useAppSelector(selectMessageSearchItems);
  const fileItems = useAppSelector(selectFileSearchItems);
  const starredItems = useAppSelector(selectStarSearchItems);
  const searchItems = useAppSelector(selectSearchSearchItems);
  const noItems =
    convoItems.length == 0 &&
    messageItems.length == 0 &&
    fileItems.length == 0 &&
    starredItems.length == 0 &&
    searchItems.length == 0;
  const handleClickToStar = (e: React.MouseEvent) => {
    e.stopPropagation();
    setStarred(!starred);
  };

  const handleClickToSearchActiveConvo = (e: React.MouseEvent) => {
    e.stopPropagation();
    setActiveConvoSearchEnabled(!activeConvoSearchEnabled);
  };

  const handleSearchInputChanged = (ev: ChangeEvent<HTMLInputElement>) => {
    setSearchInputValue(ev.target.value);
  };

  const activeConvoType = useAppSelector(selectActiveConvoType);
  const activeConvoPillText = (() => {
    if (activeConvoType === WickrConvoType.Group) return t('This group');
    else if (activeConvoType === WickrConvoType.Room) return t('This room');
    else return t('This conversation');
  })();
  const activeConvoEmptyResultText = (type: 'title' | 'filesSubtitle') => {
    if (type === 'title') {
      if (activeConvoType === WickrConvoType.Group) return t('Search this group');
      else if (activeConvoType === WickrConvoType.Room) return t('Search this room');
      else return t('Search this conversation');
    } else if (type == 'filesSubtitle') {
      if (activeConvoType === WickrConvoType.Group)
        return t('Find files and messages shared in this group.');
      else if (activeConvoType === WickrConvoType.Room)
        return t('Find files and messages shared in this room.');
      else return t('Find files and messages shared in this direct message conversation.');
    }
  };

  /**
   * Reset showAllXXX states when active tab or search input emptiness get changed
   */
  useEffect(() => {
    setShowAllConvoItems(false); // collapse list
    setShowAllMessages(false); // collapse list
    setShowAllFiles(!isSearchAll); // collapse list in ALL tab, expand list in FILES tab
  }, [isSearchAll, isSearchEmpty]);

  const fetchSearchItems = useDebouncedCallback(
    () => {
      setLoadingState('loading');

      const fetchConvoItemsCount = determineFetchCount(
        isSearchAll,
        false,
        isSearchEmpty,
        showAllConvoItems
      );
      const fetchMessageItemsCount = determineFetchCount(
        isSearchAll,
        false,
        isSearchEmpty,
        showAllMessages,
        starred,
        activeConvoSearchEnabled
      );
      const fetchFileItemsCount = determineFetchCount(
        isSearchAll,
        true,
        isSearchEmpty,
        showAllFiles,
        starred,
        activeConvoSearchEnabled
      );
      const fetchStarredItemsCount = determineFetchCount(isSearchAll, false, isSearchEmpty, false);
      const fetchSearchItemsCount = determineFetchCount(isSearchAll, false, isSearchEmpty, false);

      dispatch(
        fetchRoomSearchItems({
          query: searchInputValue,
          isStarred: starred,
          activeTab: isSearchAll ? 'all' : 'files',
          numConvoItems: fetchConvoItemsCount,
          numMessageItems: fetchMessageItemsCount,
          numFileItems: fetchFileItemsCount,
          numStarredItems: fetchStarredItemsCount,
          numSearchItems: fetchSearchItemsCount,
          vgroupId: activeConvoSearchEnabled && activeConvoId ? activeConvoId : '',
        })
      ).then(() => {
        setLoadingState('loaded');
      });
    },
    100,
    {
      leading: false,
      trailing: true,
    }
  );

  /**
   * Refresh search items when any of those interactive states changes
   */
  useEffect(fetchSearchItems, [
    isSearchAll,
    starred,
    searchInputValue,
    isSearchEmpty,
    showAllConvoItems,
    showAllMessages,
    showAllFiles,
    activeConvoSearchEnabled,
  ]);

  useEffect(() => {
    // Clear results in store on dismount
    return () => {
      dispatch(resetSlice('roomSearch'));
    };
  }, [dispatch]);

  const renderNoResultsImage = (type: 'all' | 'files') => {
    return (
      <div className={styles.noItemsImage}>
        {!(searchFiles || starred) && <Picture src={images[type].src} src2x={images[type].src2x} />}
        <div className={styles.noItemsTitle}>
          {searchInputValue
            ? t('No results found')
            : searchFiles
            ? starred
              ? t('No results found')
              : t('No files found')
            : starred
            ? t('No starred items found')
            : activeConvoSearchEnabled
            ? activeConvoEmptyResultText('title')
            : t('Search conversations')}
        </div>
        <div className={styles.noItemsSubtitle}>
          {searchInputValue
            ? t('Try using a different search term or filter.')
            : searchFiles
            ? starred
              ? t('Try using a different search term or filter.')
              : t('Once you send or receive a file, you’ll see it here.')
            : starred
            ? t("Once you star a message or file, you'll see it here.")
            : activeConvoSearchEnabled
            ? activeConvoEmptyResultText('filesSubtitle')
            : t('Find files and messages shared in your conversations.')}
        </div>
      </div>
    );
  };

  const renderMessageItems = () => {
    // only show the list in ALL tab with non-empty search or when we filter by starred items
    if (!isSearchAll) return [];

    if (!isSearchEmpty || starred) {
      return messageItems;
    } else {
      return [];
    }
  };

  const baseLabel = t('Search Input');
  const [ariaLabel, setAriaLabel] = useState(baseLabel);

  useEffect(() => {
    if (!isSearchEmpty || starred) {
      if (isSearchAll && messageItems.length) {
        setAriaLabel(
          `${baseLabel} - ${t('{{number}} results found', { number: messageItems.length })}`
        );
      } else if (fileItems.length) {
        setAriaLabel(
          `${baseLabel} - ${t('{{number}} results found', { number: fileItems.length })}`
        );
      } else {
        setAriaLabel(`${baseLabel} - ${t('No results found')}`);
      }
    }
    if (isSearchEmpty && !starred) {
      setAriaLabel(baseLabel);
    }
  }, [messageItems, fileItems, isSearchAll, isSearchEmpty, starred]);

  const handleSearchInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      if (isSearchEmpty || noItems) return;
      dispatch(saveRecentSearchQuery(searchInputValue));
    }
  };

  return (
    <Panel
      className={styles.panel}
      onClose={() => dispatch(popPanel())}
      onOutsideClick={handleOutsideClick}
      side={side}
      closeIcon={closeIcon}
    >
      <PanelHeader closeLabel={t('Close')} />
      <div className={styles.searchWrapper}>
        <SearchInput
          value={searchInputValue}
          aria-label={ariaLabel}
          onChange={handleSearchInputChanged}
          onKeyDown={handleSearchInputKeyDown}
          showClear={!!searchInputValue}
          isLoading={isLoading}
          placeholder={t('Search')}
        />
        <div className={styles.filterButtonsWrapper}>
          {activeConvoId && (
            <Button
              label={`${activeConvoPillText}${
                activeConvoSearchEnabled ? `- ${t('selected')}` : ''
              }`}
              onClick={handleClickToSearchActiveConvo}
              color={activeConvoSearchEnabled ? 'primary' : 'secondary'}
              shape="rounded"
              compact
            >
              {activeConvoSearchEnabled && <CheckIcon />}
              {activeConvoPillText}
            </Button>
          )}
          <Button
            label={`${t('Files')}${searchFiles ? `- ${t('selected')}` : ''}`}
            onClick={() => setSearchFiles(!searchFiles)}
            color={searchFiles ? 'primary' : 'secondary'}
            shape="rounded"
            compact
          >
            {searchFiles && <CheckIcon />}
            {t('Files')}
          </Button>
          <Button
            label={`${t('Starred')}${starred ? `- ${t('selected')}` : ''}`}
            onClick={handleClickToStar}
            color={starred ? 'primary' : 'secondary'}
            shape="rounded"
            compact
          >
            <StarIcon width="18px" height="18px" filled={starred} />
            {t('Starred')}
          </Button>
        </div>
      </div>
      <PanelBody className={styles.panelBody}>
        {isSearchAll
          ? noItems && renderNoResultsImage('all')
          : fileItems.length === 0 && renderNoResultsImage('files')}

        <VirtualListContainer id="search-result-list" preloadOffset={200}>
          <SearchResultList
            header={isSearchEmpty ? t('Recent Conversations') : t('Conversations')}
            // only show the list in ALL tab
            items={isSearchAll ? convoItems : []}
            // display the button if search is not empty and the number of searched items exceeds the threshold
            displayShowAllButton={!isSearchEmpty && convoItems.length > RECENT_ITEMS_THRESHOLD}
            showAll={showAllConvoItems}
            collapsedCount={RECENT_ITEMS_THRESHOLD}
            onShowAllClicked={() => setShowAllConvoItems(!showAllConvoItems)}
            initialItemHeight={39}
          />
          <SearchResultList
            header={t('Messages')}
            items={renderMessageItems()}
            // display the button if search is not empty and the number of searched items exceeds the threshold
            displayShowAllButton={messageItems.length > RECENT_ITEMS_THRESHOLD}
            showAll={showAllMessages}
            collapsedCount={RECENT_ITEMS_THRESHOLD}
            onShowAllClicked={() => setShowAllMessages(!showAllMessages)}
            initialItemHeight={100}
            searchInputValue={searchInputValue}
          />
          <SearchResultList
            showAll={showAllFiles}
            header={isSearchEmpty && isSearchAll && !starred ? t('Recent Files') : t('Files')}
            items={fileItems}
            collapsedCount={RECENT_ITEMS_THRESHOLD}
            initialItemHeight={72}
            searchInputValue={searchInputValue}
          />
          <SearchResultList
            header={t('Recently Starred')}
            items={isSearchAll && isSearchEmpty ? starredItems : []}
            collapsedCount={RECENT_ITEMS_THRESHOLD}
            initialItemHeight={80}
            searchInputValue={searchInputValue}
          />
          <SearchResultList
            header={t('Recent Searches')}
            items={isSearchAll && isSearchEmpty ? searchItems : []}
            collapsedCount={RECENT_SEARCHES_ITEMS_THRESHOLD}
            initialItemHeight={39}
            onRecentSearchItemClick={setSearchInputValue}
          />
        </VirtualListContainer>
      </PanelBody>
    </Panel>
  );
};
