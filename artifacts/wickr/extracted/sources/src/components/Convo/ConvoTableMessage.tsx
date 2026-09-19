import { clsx } from 'clsx';
import React, { FC, useMemo, useState } from 'react';
import ReactPaginate from 'react-paginate';
import { ListItem, CaretIcon, Button } from '@/componentlibrary';
import { useAppTranslation } from '@/lib/i18n';
import { WickrTableMeta } from '@/lib/protobuf/messages';
import { useAppDispatch } from '@/store';
import { sendTextMessage } from '@/store/thunks/messages';

import styles from './ConvoTableMessage.module.less';

interface ConvoTableMessageProps {
  tableMeta: WickrTableMeta;
  showActionButtons?: boolean;
  convoId: string;
}

interface PageEvent {
  selected: number;
}

const MAX_ITEMS_PER_PAGE = 8;

const ConvoTableMessage: FC<ConvoTableMessageProps> = ({
  tableMeta,
  showActionButtons = false,
  convoId,
}) => {
  const items = tableMeta.items;
  const [hidePreviousLabel, setHidePreviousLabel] = useState(true);
  const [hideNextLabel, setHideNextLabel] = useState(false);

  const [itemOffset, setItemOffset] = useState(0);

  const { t } = useAppTranslation();
  const dispatch = useAppDispatch();

  const shouldPaginate = (items?.length || 0) > MAX_ITEMS_PER_PAGE;

  const pageCount = useMemo(() => {
    if (!shouldPaginate || !items?.length) return 0;
    return Math.ceil(items.length / MAX_ITEMS_PER_PAGE);
  }, [items?.length, shouldPaginate]);

  const currentItems = useMemo(() => {
    if (!shouldPaginate || !items?.length) return items;
    const endOffset = itemOffset + MAX_ITEMS_PER_PAGE;
    return items.slice(itemOffset, endOffset);
  }, [items, itemOffset, shouldPaginate]);

  const handlePageClick = (event: PageEvent) => {
    // if on first page
    setHidePreviousLabel(event.selected === 0);

    // if on last page
    setHideNextLabel(event.selected === pageCount - 1);

    const newOffset = (event.selected * MAX_ITEMS_PER_PAGE) % (items?.length || 0);
    setItemOffset(newOffset);
  };

  // TODO: remove below comment and variable when we have a 2 column example we can access with a bot command
  // For testing second column: edit this variable below
  const showSecondColumn = tableMeta.secondColumnName;

  // TODO: Implement button functionality
  const renderItems = currentItems?.map((item, index) => {
    if (!item || !item.firstColumnValue) return;

    const handleClick = () => {
      return dispatch(sendTextMessage({ message: item.response || '', vgroupId: convoId }));
    };

    return (
      <ListItem key={item.firstColumnValue + index} className={styles.listItem}>
        <div className={styles.firstColumn}>{item.firstColumnValue}</div>

        {showSecondColumn && <div className={styles.secondColumn}>{item.secondColumnValue}</div>}

        {showActionButtons && item.response && (
          <div className={styles.actionColumn}>
            <Button color="secondaryBlue" onClick={handleClick}>
              {t('Select')}
            </Button>
          </div>
        )}
      </ListItem>
    );
  });

  type NavDirection = 'previous' | 'next';

  const navigationLabel = (direction: NavDirection) => {
    return (
      <div className={styles.navLabel}>
        {direction === 'previous' && <CaretIcon direction="left" />}
        {direction === 'previous' ? t('Previous') : t('Next')}
        {direction === 'next' && <CaretIcon direction="right" />}
      </div>
    );
  };

  return (
    <div className={styles.convoTableMessage}>
      <ListItem className={styles.tableName}>{tableMeta.name}</ListItem>
      <ListItem className={clsx(styles.listItem, styles.header)}>
        <div className={styles.firstColumn}>{tableMeta.firstColumnName}</div>

        {showSecondColumn && (
          <div className={styles.secondColumn}>{tableMeta.secondColumnName}</div>
        )}

        <div className={styles.actionColumn}>{t('Message.Action')}</div>
      </ListItem>
      <div className={clsx(styles.listItemContainer, { [styles.paginated]: shouldPaginate })}>
        {renderItems}
      </div>
      {shouldPaginate && (
        <ReactPaginate
          pageCount={pageCount}
          onPageChange={handlePageClick}
          pageRangeDisplayed={0}
          marginPagesDisplayed={0}
          pageClassName={styles.pages}
          previousLabel={navigationLabel('previous')}
          nextLabel={navigationLabel('next')}
          previousClassName={clsx(styles.previous, {
            [styles.hidden]: hidePreviousLabel,
          })}
          nextClassName={clsx(styles.next, {
            [styles.hidden]: hideNextLabel,
          })}
          nextLinkClassName={styles.nextLink}
          previousLinkClassName={styles.previousLink}
          breakClassName={styles.break}
          containerClassName={styles.paginationContainer}
        />
      )}
    </div>
  );
};

const MemoComponent = React.memo(ConvoTableMessage);
if (__DEV__) MemoComponent.displayName = 'ConvoTableMessage';

export default MemoComponent;
