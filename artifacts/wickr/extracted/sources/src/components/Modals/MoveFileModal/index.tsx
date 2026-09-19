import { FC, useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import FileManagementPreview from '../../FileManagement/FileManagementPreview';
import { generateChatRoute } from '@/chat/routes';
import {
  CautionIcon,
  Modal,
  ModalBody,
  ModalButtonGroup,
  ModalHeader,
  PrimaryButton,
  Button,
} from '@/componentlibrary';
import { useAppTranslation } from '@/lib/i18n';
import { SAVED_ITEMS_UUID } from '@/lib/protobuf/files';
import { useAppDispatch, useAppSelector, useAppSelectorExtra } from '@/store';
import {
  selectActiveCurrentFolderId,
  selectActiveFileItemById,
  selectActiveFileItemsInFolderById,
  selectActiveRootFolderId,
  selectActiveSelectedFileItemId,
  selectIsAtMaximumDepthByFolderId,
  setSelectedFileItemId,
} from '@/store/slices/files';
import { selectActiveConvoId } from '@/store/slices/shared';
import { fetchFolder, moveFile, moveFolder } from '@/store/thunks/files';
import { closeModal } from '@/store/thunks/modals';
import { MAX_NESTED_FOLDERS, isFolder } from '@/utils/files';

import styles from './MoveFileModal.module.less';

const MoveFileModal: FC = () => {
  const { t } = useAppTranslation();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const activeConvoId = useAppSelector(selectActiveConvoId);
  const currentFolderId = useAppSelector(selectActiveCurrentFolderId);
  const [targetFolderId, setTargetFolderId] = useState(currentFolderId);
  const currentMovingItemId = useAppSelector(selectActiveSelectedFileItemId);
  const currentMovingItem = useAppSelectorExtra(
    selectActiveFileItemById,
    currentMovingItemId ?? ''
  );
  const targetFolderContents = useAppSelectorExtra(
    selectActiveFileItemsInFolderById,
    targetFolderId
  );
  const rootFolderId = useAppSelector(selectActiveRootFolderId);
  const isAtMaximumDepth = useAppSelectorExtra(selectIsAtMaximumDepthByFolderId, targetFolderId);
  const [error, setError] = useState('');

  useEffect(() => {
    dispatch(fetchFolder({ vgroupId: activeConvoId, folderId: targetFolderId }));
  }, [activeConvoId, targetFolderId]);

  const handleClose = () => {
    dispatch(closeModal('MoveFileModal'));
    dispatch(setSelectedFileItemId({ vgroupId: activeConvoId, fileId: '' }));
  };

  const handleSubmit = () => {
    if (
      !currentMovingItemId ||
      !currentMovingItem ||
      (isFolder(currentMovingItem) && targetFolderId === SAVED_ITEMS_UUID)
    ) {
      // Invalid item id or target folder id
      dispatch(closeModal('MoveFileModal'));
      return;
    }

    if (currentFolderId === targetFolderId) {
      // User did not move it anywhere
      dispatch(closeModal('MoveFileModal'));
      return;
    }

    for (const item of targetFolderContents) {
      if (
        item.fileItemType === currentMovingItem.fileItemType &&
        item.name === currentMovingItem.name
      ) {
        setError(
          isFolder(item)
            ? t('FileManagement.MovingDuplicateFolderName', {
                folderName: currentMovingItem?.name,
              })
            : t('FileManagement.MovingDuplicateFilename', {
                filename: currentMovingItem?.name,
              })
        );
        return;
      }
    }
    if (isFolder(currentMovingItem)) {
      if (isAtMaximumDepth) {
        // Already at max levels deep - cannot move folder here
        setError(
          t('FileManagement.MaximumFolderDepthExceeded', {
            folderName: currentMovingItem?.name,
            maxDepth: MAX_NESTED_FOLDERS - 1,
          })
        );
        return;
      }

      dispatch(
        moveFolder({
          vgroupId: activeConvoId,
          folderId: currentMovingItem.uuid,
          newParentFolderId: targetFolderId,
        })
      );
    } else {
      dispatch(
        moveFile({
          vgroupId: activeConvoId,
          fileId: currentMovingItem.uuid,
          newFolderId: targetFolderId,
        })
      );
    }

    // Navigate to target folder on submit
    navigate(
      generateChatRoute.convo(activeConvoId, 'files', {
        // Ensure the root folder ID doesn't get set in the App Route Path.
        folderId: targetFolderId === rootFolderId ? '' : targetFolderId,
      })
    );
    dispatch(closeModal('MoveFileModal'));
  };

  const handleFolderClick = (folderId: string) => {
    setTargetFolderId(folderId);
    // Clear folder error upon navigation out of max depth folder
    if (!isAtMaximumDepth) {
      setError('');
    }
  };

  return (
    <Modal closeLabel={t('Close')} onClose={handleClose}>
      <ModalHeader>
        <div className={styles.modalTitle}>
          {t('FileManagement.Move')}{' '}
          <span className={styles.filename}>{currentMovingItem?.name}</span>
        </div>
      </ModalHeader>
      <ModalBody className={styles.modalBody}>
        <FileManagementPreview targetFolderId={targetFolderId} onFolderClick={handleFolderClick} />
        {error && (
          <div className={styles.folderWarning}>
            <CautionIcon size="24px" />
            <span aria-role="alert">{error}</span>
          </div>
        )}
      </ModalBody>
      <ModalButtonGroup>
        <Button bordered onClick={handleClose}>
          {t('Cancel')}
        </Button>
        <PrimaryButton onClick={handleSubmit}>{t('FileManagement.Move')}</PrimaryButton>
      </ModalButtonGroup>
    </Modal>
  );
};

export default MoveFileModal;
