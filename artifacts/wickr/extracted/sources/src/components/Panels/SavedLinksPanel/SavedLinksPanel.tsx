import { FC, useEffect, useReducer, useState } from 'react';
import { CancelRemoveButtonRow } from '../CancelRemoveButtonRow';
import {
  IconButton,
  Panel,
  PanelBody,
  PanelHeader,
  DeleteIcon,
  List,
  Heading,
} from '@/componentlibrary';
import Picture from '@/componentlibrary/Picture';
import { useAppTranslation } from '@/lib/i18n';
import { WickrLinkItem } from '@/lib/protobuf/links';
import { useAppDispatch, useAppSelector, useAppSelectorExtra } from '@/store';
import { selectActiveConvoCanModifyPinnedFilesLinks } from '@/store/slices/convos';
import { selectSavedLinkItems } from '@/store/slices/files';
import { selectActiveModal } from '@/store/slices/modal';
import {
  clearPanelStack,
  PANEL_SIDES,
  popPanel,
  selectIsActivePanel,
  SavedLinksPanelArgs,
} from '@/store/slices/panels';
import { selectActiveConvoId } from '@/store/slices/shared';
import { fetchSavedLinks, unpinItems } from '@/store/thunks/files';
import { SavedLinksListItem } from './SavedLinksListItem';
import noSavedItemsPin from './no_saved_items_pin.png';
import noSavedItemsPin2x from './no_saved_items_pin@2x.png';

import styles from './SavedLinksPanel.module.less';

// TODO: Implement batch select and removal for saved items

export const SavedLinksPanel: FC<SavedLinksPanelArgs> = ({ name, closeIcon }) => {
  const { t } = useAppTranslation();
  const side = PANEL_SIDES[name];
  const dispatch = useAppDispatch();
  const panelIsActive = useAppSelectorExtra(selectIsActivePanel, name);
  const activeModal = useAppSelector(selectActiveModal);
  const handleOutsideClick = () => panelIsActive && !activeModal && dispatch(clearPanelStack());
  const activeConvoId = useAppSelector(selectActiveConvoId);
  const linkItems = useAppSelector(selectSavedLinkItems);
  const [isSelectingItems, toggleIsSelectingItems] = useReducer((s) => !s, false);
  const [selectedLinkItemUrls, setSelectedLinkItemUrls] = useState<string[]>([]);
  const panelHasItems = linkItems.length > 0;
  const canModifyPinnedFilesLinks = useAppSelector(selectActiveConvoCanModifyPinnedFilesLinks);

  useEffect(() => {
    dispatch(fetchSavedLinks({ vgroupId: activeConvoId }));
  }, [activeConvoId]);

  const handleLinkSelectionChange = (linkItem: WickrLinkItem, selected: boolean) => {
    if (selected) {
      setSelectedLinkItemUrls([...selectedLinkItemUrls, linkItem.url || '']);
    } else {
      setSelectedLinkItemUrls(selectedLinkItemUrls.filter((url) => url !== linkItem.url));
    }
  };

  const getNoSavedItemsContent = () => {
    return (
      <div className={styles.noSavedItemsContent}>
        <Picture src={noSavedItemsPin} src2x={noSavedItemsPin2x} />
        <div className={styles.noSavedItemsTitle}>{t('No saved links')}</div>
        <div className={styles.noSavedItemsSubtitle}>
          {t(
            'Moderators can save links to share with all new and current participants. Once a link has been saved to a room, it will appear here.'
          )}
        </div>
      </div>
    );
  };

  const getSavedItemsContent = () => {
    if (!linkItems.length) {
      return getNoSavedItemsContent();
    }

    const content = linkItems.map((link) => {
      return (
        <SavedLinksListItem
          showCheck={isSelectingItems}
          checked={link.url ? selectedLinkItemUrls.includes(link.url) : false}
          key={link.id}
          link={link}
          onCheck={(ev) => handleLinkSelectionChange(link, ev.target.checked)}
        />
      );
    });

    return <List className={styles.itemsList}>{content}</List>;
  };

  const handleCancelItemSelection = () => {
    toggleIsSelectingItems();
    setSelectedLinkItemUrls([]);
  };

  const handleRemoveSelectedItems = () => {
    if (selectedLinkItemUrls.length === 0) {
      handleCancelItemSelection();
      return;
    }

    dispatch(
      unpinItems({
        vgroupId: activeConvoId,
        files: [],
        links: selectedLinkItemUrls,
      })
    );

    handleCancelItemSelection();
  };

  return (
    <Panel
      onClose={() => dispatch(popPanel())}
      onOutsideClick={handleOutsideClick}
      side={side}
      className={styles.savedLinksPanel}
      closeIcon={closeIcon}
    >
      <PanelHeader
        title={t('Conversations.ConvoHeader.SavedLinks')}
        closeLabel={t('Close')}
        trailingElement={
          !isSelectingItems &&
          canModifyPinnedFilesLinks &&
          panelHasItems && (
            <IconButton label={t('Remove saved links')} onClick={toggleIsSelectingItems}>
              <DeleteIcon size="1.5rem" />
            </IconButton>
          )
        }
      />
      <PanelBody className={styles.savedLinksPanelBody}>
        {linkItems.length > 0 && (
          <Heading level={3} className={styles.linksTitle}>
            {t('Links ({{count}})', { count: linkItems.length })}
          </Heading>
        )}
        {getSavedItemsContent()}
        {isSelectingItems && panelHasItems && (
          <div className={styles.removeButtonRow}>
            <CancelRemoveButtonRow
              onCancel={handleCancelItemSelection}
              onRemove={handleRemoveSelectedItems}
            />
          </div>
        )}
      </PanelBody>
    </Panel>
  );
};
