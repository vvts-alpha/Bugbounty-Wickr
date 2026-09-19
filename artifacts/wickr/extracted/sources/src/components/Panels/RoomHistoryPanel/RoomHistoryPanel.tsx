import { useEffect, FC, useState, useMemo } from 'react';
import {
  Panel,
  PanelBody,
  PanelHeader,
  IconButton,
  CaretIcon,
  PopOver,
  PrimaryButton,
} from '@/componentlibrary';
import Picture from '@/componentlibrary/Picture';
import { VirtualList } from '@/componentlibrary/VirtualList/VirtualList';
import { useAppTranslation } from '@/lib/i18n';
import { WickrConvoType } from '@/lib/protobuf/convos';
import { useAppDispatch, useAppSelector, useAppSelectorExtra } from '@/store';
import { selectActiveConvoType } from '@/store/slices/convos';
import { selectActiveModal } from '@/store/slices/modal';
import {
  clearPanelStack,
  PANEL_SIDES,
  popPanel,
  RoomHistoryPanelArgs,
  selectIsActivePanel,
} from '@/store/slices/panels';
import { RoomHistoryFilterOption, selectRoomHistoryByConvoId } from '@/store/slices/roomHistory';
import { fetchRoomHistoryListItems } from '@/store/thunks/roomHistory';
import RoomHistoryListItem from './RoomHistoryListItem';
import RoomHistoryPopOverMenuItems from './RoomHistoryPopOverMenuItems';
import icHistoryEmpty from './ic-history-empty.png';
import icHistoryEmpty2x from './ic-history-empty@2x.png';

import styles from './styles.module.less';

export const RoomHistoryPanel: FC<RoomHistoryPanelArgs> = ({
  convoId,
  highlightedMsgId,
  name,
  closeIcon,
}) => {
  const { t } = useAppTranslation();
  const side = PANEL_SIDES[name];
  const dispatch = useAppDispatch();
  const panelIsActive = useAppSelectorExtra(selectIsActivePanel, name);
  const activeModal = useAppSelector(selectActiveModal);
  const handleOutsideClick = () => panelIsActive && !activeModal && dispatch(clearPanelStack());
  const convoType = useAppSelector(selectActiveConvoType);
  const isConvoTypeRoom = convoType === WickrConvoType.Room;
  const [filterOption, setFilterOption] = useState<RoomHistoryFilterOption>('all');
  const roomHistory = useAppSelectorExtra(selectRoomHistoryByConvoId, convoId);

  useEffect(() => {
    if (convoId) {
      dispatch(fetchRoomHistoryListItems(convoId));
    }
  }, [convoId]);

  const filteredRoomHistoryItems = useMemo(() => {
    if (filterOption === 'all') {
      return roomHistory;
    }
    return roomHistory.filter((item) => item.type === filterOption);
  }, [filterOption, roomHistory]);

  const renderFilterLabel = () => {
    switch (filterOption) {
      case 'members':
        return t('Members');
      case 'settings':
        return t('Settings');
      case 'savedItems':
        return t('Saved items');
      case 'all':
      default:
        return t('All');
    }
  };

  const renderRoomHistoryPanelBody = () => {
    if (!filteredRoomHistoryItems?.length) {
      return renderNoResultsContent();
    }
    return (
      <VirtualList
        id="room-history"
        items={filteredRoomHistoryItems}
        keySelector={(item) => item.msgId}
        itemHeightType="static"
        scrollTo={highlightedMsgId ? { itemKey: highlightedMsgId } : undefined}
        renderItem={(item) => {
          return (
            <RoomHistoryListItem
              key={item.msgId}
              isHighlighted={item.msgId === highlightedMsgId}
              roomHistoryItem={item}
            />
          );
        }}
        dependencies={[highlightedMsgId]}
        className={styles.list}
      />
    );
  };

  const renderNoResultsContent = () => {
    return (
      <div className={styles.noFilterResultContent}>
        <Picture src={icHistoryEmpty} src2x={icHistoryEmpty2x} />
        <div className={styles.noFilterResultTitle}>{t('No Results')}</div>
        <div className={styles.noFilterResultSubtitle}>
          {t('Trying using a different filter option or see all results')}
        </div>
        <div>
          <PrimaryButton className={styles.showAllButton} onClick={() => setFilterOption('all')}>
            {t('Show all')}
          </PrimaryButton>
        </div>
      </div>
    );
  };

  return (
    <Panel
      className={styles.panel}
      onClose={() => dispatch(popPanel())}
      onOutsideClick={handleOutsideClick}
      side={side}
      closeIcon={closeIcon}
    >
      <PanelHeader
        title={isConvoTypeRoom ? t('Room History') : t('Group History')}
        closeLabel={t('Close')}
        trailingElement={
          <>
            <div className={styles.titlePopover}>{renderFilterLabel()}</div>
            <PopOver
              popoverContent={
                <RoomHistoryPopOverMenuItems
                  onSelectFilter={(option) => {
                    setFilterOption(option);
                  }}
                  selectedOption={filterOption}
                />
              }
              contentWrapperClassName={styles.titlePopoverBtn}
              menuClassName={styles.optionsMenu}
            >
              <IconButton label={t('Filter options')}>
                <CaretIcon />
              </IconButton>
            </PopOver>
          </>
        }
      />
      <PanelBody>{renderRoomHistoryPanelBody()}</PanelBody>
    </Panel>
  );
};
