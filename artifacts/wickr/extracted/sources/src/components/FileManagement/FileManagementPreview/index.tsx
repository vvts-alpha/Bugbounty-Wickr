import { clsx } from 'clsx';
import { Breadcrumbs } from '../../Breadcrumbs';
import FileManagementItem from '../FileManagementItem';
import { List } from '@/componentlibrary';
import { SAVED_ITEMS_UUID, WickrFileItem } from '@/lib/protobuf/files';
import { useAppSelector, useAppSelectorExtra } from '@/store';
import {
  selectActiveFileItemsInFolderById,
  selectActiveSelectedFileItemId,
} from '@/store/slices/files';
import { isFolder } from '@/utils/files';

import styles from './styles.module.less';

interface FileManagementPreviewProps {
  targetFolderId: string;
  onFolderClick: (folderId: string) => void;
}

const FileManagementPreview = ({ targetFolderId, onFolderClick }: FileManagementPreviewProps) => {
  const items = useAppSelectorExtra(selectActiveFileItemsInFolderById, targetFolderId).filter(
    (item) => item.uuid !== SAVED_ITEMS_UUID
  );
  const currentMovingItemId = useAppSelector(selectActiveSelectedFileItemId);

  const handleBreadcrumbClick = (id: string) => {
    onFolderClick(id);
  };

  const handleItemClick = (item: WickrFileItem) => {
    if (currentMovingItemId === item.uuid) {
      // Moving folders into themselves is not allowed
      return;
    } else if (!isFolder(item)) {
      return;
    }

    onFolderClick(item.uuid);
  };

  return (
    <div className={styles.fileManagementPreview}>
      <Breadcrumbs
        isPreview={true}
        previewFolderId={targetFolderId}
        onClick={handleBreadcrumbClick}
      />
      <List className={clsx(styles.list, styles.previewItemsList)}>
        {items.map((file) => (
          <FileManagementItem
            item={file}
            key={file.uuid + '_preview'}
            isPreview={true}
            onClick={() => handleItemClick(file)}
            disabled={
              currentMovingItemId === file.uuid || file.uuid === SAVED_ITEMS_UUID || !isFolder(file)
            }
          />
        ))}
      </List>
    </div>
  );
};

export default FileManagementPreview;
