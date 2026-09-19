import { FC, useMemo } from 'react';
import { Button } from '@/componentlibrary';
import { NonVirtualListItems } from '@/componentlibrary/VirtualList/NonVirtualListItems';
import { VirtualListItems } from '@/componentlibrary/VirtualList/VirtualListItems';
import { ClockIcon } from '@/componentlibrary/icons/Clock';
import { useAppTranslation } from '@/lib/i18n';
import { Logger } from '@/lib/logger';
import { WickrMessageMention, WickrMessageMentions } from '@/lib/protobuf/messages';
import { useAppDispatch } from '@/store';
import { useSetting } from '@/store/hooks/useSetting';
import {
  SearchItem,
  MessageSearchItem,
  FileSearchItem,
  ConvoSearchItem,
  isMessageSearchItem,
  isFileSearchItem,
} from '@/store/slices/roomSearch';
import { setHighlightedMsgId } from '@/store/slices/uiChat';
import { switchActiveConvoAndMessage } from '@/store/thunks/messages';
import { saveRecentSearchQuery } from '@/store/thunks/roomSearch';
import { getHash, prettyFormatLog } from '@/utils/strings';
import { MessageSearchListItem } from './SearchListItems/MessageSearchListItem';
import { SimpleSearchListItem } from './SearchListItems/SimpleSearchListItem';

import styles from './styles.module.less';

interface SearchResultListProps {
  /** Initial height of every list item before they are rendered, used for virtual list, choose closest value */
  initialItemHeight?: number;
  /** Text to be displayed in list header */
  header: ReactJSXChild;
  /** List items */
  items: SearchItem[];
  /** Control if show all button will be rendered */
  displayShowAllButton?: boolean;
  /** Control the show all button text, when set to false, it will slice items array to render limited number of items based on collapsedCount */
  showAll?: boolean;
  /** when showAll is false, it will slice items array to render first {collapsedCount} items */
  collapsedCount?: number;
  /** Callback when show all button is clicked */
  onShowAllClicked?: () => void;
  /** Callback when a search result item is clicked, it will receive the vGroupId and msgId of the clicked item, for items don't have vGroupId and msgId, the callback will not be fired */
  onSearchResultClicked?: (vGroupId: string, msgId?: string) => void;
  /** Sets the input value of the Search Panel to the recent search item's content */
  onRecentSearchItemClick?: (value: string) => void;
  searchInputValue?: string;
}

const logger = new Logger('SearchResultList');

export const SearchResultList: FC<SearchResultListProps> = ({
  initialItemHeight,
  header,
  items,
  showAll,
  collapsedCount,
  displayShowAllButton = false,
  onShowAllClicked,
  onRecentSearchItemClick,
  searchInputValue,
}) => {
  const dispatch = useAppDispatch();
  const constructFileString = (fileName: string) => {
    const fileExtension = fileName.split('.').pop()?.toUpperCase();
    return `${fileExtension} - ${fileName}`;
  };
  const { t } = useAppTranslation();
  const isBeta = useSetting('isBeta');
  const modifiedItems = useMemo(() => {
    if (!showAll && collapsedCount !== undefined && items.length > collapsedCount) {
      return items.slice(0, collapsedCount);
    }
    return items;
  }, [showAll, collapsedCount, items]);

  if (!items.length) return null;

  const formatTimestampToReadableDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const formattedDate = t('Intl.DateTime', {
      val: date,
      formatParams: { val: { month: 'short', day: 'numeric' } },
    });
    const formattedTime = t('Intl.DateTime', {
      val: date,
      formatParams: { val: { hour: '2-digit', minute: '2-digit' } },
    });

    return `${formattedDate} - ${formattedTime}`;
  };

  const handleMessageOrFileItemClick = (item: MessageSearchItem | FileSearchItem) => {
    if (searchInputValue?.trim().length) {
      dispatch(saveRecentSearchQuery(searchInputValue));
    }
    dispatch(switchActiveConvoAndMessage({ vGroupID: item.vgroupId, scrollToMsgId: item.msgId }));
    dispatch(setHighlightedMsgId(item.msgId));
  };

  const handleConvoItemClick = (item: ConvoSearchItem) => {
    if (searchInputValue?.trim().length) {
      dispatch(saveRecentSearchQuery(searchInputValue));
    }
    dispatch(switchActiveConvoAndMessage({ vGroupID: item.vgroupId }));
  };
  const SearchItemSeparator = () => <div className={styles.searchItemSeparator} />;

  return (
    <>
      <NonVirtualListItems>
        <h4 className={styles.header}>
          <span>{header}</span>
          {displayShowAllButton && (
            <Button className={styles.showAllButton} onClick={onShowAllClicked}>
              {showAll ? t('Show less') : t('Show all')}
            </Button>
          )}
        </h4>
      </NonVirtualListItems>

      <div>
        <VirtualListItems
          items={modifiedItems}
          keySelector={(item, index, listId) => {
            if (isMessageSearchItem(item) || isFileSearchItem(item)) {
              return `${listId}-${item.msgId}`;
            } else if (item.type === 'convo') {
              return `${listId}-${item.vgroupId}`;
            } else if (item.type === 'search') {
              return `${listId}-${index}-${getHash(item.content)}`;
            }
            logger.error('Unknown search item type for keySelector', item);
            return `${listId}-${index}`;
          }}
          dependencies={[searchInputValue]}
          renderItem={(item, index) => {
            const isLast = index === modifiedItems.length - 1;
            if (item.type === 'convo') {
              return (
                <>
                  <SimpleSearchListItem
                    title={item.convoName}
                    description={item.isRoom ? 'Room' : undefined}
                    onClick={() => handleConvoItemClick(item)}
                  />
                  {!isLast && <SearchItemSeparator />}
                </>
              );
            } else if (item.type === 'search') {
              return (
                <>
                  <SimpleSearchListItem
                    title={item.content}
                    onClick={() => onRecentSearchItemClick?.(item.content)}
                    icon={<ClockIcon size="16px" />}
                  />
                  {!isLast && <SearchItemSeparator />}
                </>
              );
            } else if (isMessageSearchItem(item)) {
              let messageMentions: WickrMessageMentions = [];
              if (item.mentions) {
                messageMentions = item.mentions.map((mention): WickrMessageMention => {
                  return { startIndex: mention.start, endIndex: mention.end, userid: '' };
                });
              }
              return (
                <>
                  <MessageSearchListItem
                    vGroupId={item.vgroupId}
                    msgId={item.msgId}
                    title={item.convoName}
                    description={item.senderDisplayName}
                    timestamp={formatTimestampToReadableDate(item.timestamp)}
                    isStarred={item.starred}
                    content={item.messageBody.trim()}
                    mentions={messageMentions}
                    onClick={() => handleMessageOrFileItemClick(item)}
                    searchInputValue={searchInputValue}
                  />
                  {!isLast && <SearchItemSeparator />}
                </>
              );
            } else if (isFileSearchItem(item)) {
              return (
                <>
                  <MessageSearchListItem
                    vGroupId={item.vgroupId}
                    msgId={item.msgId}
                    title={item.convoName}
                    description={item.senderDisplayName}
                    timestamp={formatTimestampToReadableDate(item.timestamp)}
                    isStarred={item.starred}
                    attachmentType={item.fileType}
                    content={constructFileString(item.fileName)}
                    onClick={() => handleMessageOrFileItemClick(item)}
                    searchInputValue={searchInputValue}
                  />
                  {!isLast && <SearchItemSeparator />}
                </>
              );
            }
            // for unknown item type, we print the item as string in beta but don't render it in prod
            if (isBeta) {
              return <pre style={{ whiteSpace: 'pre-wrap' }}>{prettyFormatLog(item)}</pre>;
            } else {
              logger.error('Unknown search item type', item);
              return null;
            }
          }}
          itemHeightType="dynamic"
          initialItemHeight={initialItemHeight}
        />
      </div>
    </>
  );
};
