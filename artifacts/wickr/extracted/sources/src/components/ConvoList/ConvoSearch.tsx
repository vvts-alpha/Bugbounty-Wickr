import Fuse from 'fuse.js';
import { ChangeEvent, forwardRef, useEffect, useImperativeHandle, useMemo, useState } from 'react';
import { useSetCoachMarkTarget } from '../CoachMarks/hooks';
import {
  IconButton,
  ConvoSortIcon,
  Tooltip,
  PopOverItem,
  PopOver,
  SearchInput,
} from '@/componentlibrary';
import useDebouncedCallback from '@/hooks/useDebouncedCallback';
import useFuse from '@/hooks/useFuse';
import { useAppTranslation } from '@/lib/i18n';
import { WickrConvoType } from '@/lib/protobuf/convos';
import { useAppDispatch, useAppSelector } from '@/store';
import { useSetting } from '@/store/hooks/useSetting';
import { ConvoEntity, selectAllConvos } from '@/store/slices/convos';
import { updateConvoListSortMode } from '@/store/thunks/settings';

import styles from './styles.module.less';

const fuseOptions: Fuse.IFuseOptions<any> = {
  keys: ['title', { name: 'dmTitle', weight: 8 }],
  isCaseSensitive: false,
  threshold: 0.3,
  ignoreLocation: true,
};

interface ConvoSearchProps {
  onSearchResultsChanged: (results: ConvoEntity[] | undefined) => void;
}

export interface ConvoSearchRef {
  /** Clears the search input. */
  clear: () => void;
}

export const CONVO_LIST_SEARCH_INPUT_ID = 'ConvoListSearchInput';

const ConvoSearch = forwardRef<ConvoSearchRef | null, ConvoSearchProps>(
  ({ onSearchResultsChanged }, ref) => {
    const { t } = useAppTranslation();
    const dispatch = useAppDispatch();
    const convos = useAppSelector(selectAllConvos);
    const convosForSearch = useMemo(
      () =>
        convos.map((convo) => {
          const isDM = convo.type == WickrConvoType.DM && !convo.isBot;
          return {
            convo: convo,
            title: isDM ? '' : convo.title,
            dmTitle: isDM ? convo.title : '',
          };
        }),
      [convos]
    );
    const [inputValue, setInputValue] = useState('');
    const searchFuse = useFuse(convosForSearch, fuseOptions);
    const sortMode = useSetting('convoListSortMode');

    const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
      setInputValue(e.target.value);
    };

    const searchConvos = () => {
      const trimmedInput = inputValue.trim();
      if (trimmedInput.length === 0) {
        onSearchResultsChanged(undefined);
        return;
      }

      const results = searchFuse.search(trimmedInput).map((result) => result.item.convo);
      onSearchResultsChanged(results);
    };

    const throttledSearch = useDebouncedCallback(searchConvos, 150, {
      maxWait: 300,
    });

    useEffect(() => {
      throttledSearch();
    }, [inputValue]);

    useImperativeHandle(
      ref,
      () => ({
        clear: () => setInputValue(''),
      }),
      []
    );

    const tourRef = useSetCoachMarkTarget('tutorial-tour', 'messages');

    return (
      <div className={styles.inputWrapper}>
        <SearchInput
          className={styles.input}
          value={inputValue}
          onChange={handleInputChange}
          placeholder={t('ConvoList.Header.Search.Placeholder')}
          id={CONVO_LIST_SEARCH_INPUT_ID}
          ref={tourRef}
        />
        <Tooltip tip={t('Sort')}>
          <div className={styles.sortBtnWrapper}>
            <PopOver
              popoverContent={() => [
                <PopOverItem
                  checked={sortMode === 'recent'}
                  contentClassName={styles.sortPopOverItem}
                  onClick={() => dispatch(updateConvoListSortMode('recent'))}
                  key="recent"
                >
                  {t('SortByMostRecent')}
                </PopOverItem>,
                <PopOverItem
                  checked={sortMode === 'name'}
                  contentClassName={styles.sortPopOverItem}
                  onClick={() => dispatch(updateConvoListSortMode('name'))}
                  key="name"
                >
                  {t('SortByName')}
                </PopOverItem>,
              ]}
            >
              <IconButton className={styles.sortBtn} label={t('Sort')}>
                <ConvoSortIcon sortMode={sortMode} />
              </IconButton>
            </PopOver>
          </div>
        </Tooltip>
      </div>
    );
  }
);

export default ConvoSearch;
