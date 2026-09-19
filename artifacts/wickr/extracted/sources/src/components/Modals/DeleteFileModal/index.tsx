import {
  Modal,
  ModalBody,
  ModalButtonGroup,
  ModalHeader,
  PrimaryButton,
  Button,
} from '@/componentlibrary';
import { useAppTranslation } from '@/lib/i18n';
import { useAppDispatch, useAppSelector, useAppSelectorExtra } from '@/store';
import { useFeature } from '@/store/hooks/useFeature';
import {
  selectActiveFileItemById,
  selectActiveLegacyFileItemById,
  selectActiveSelectedFileItemId,
} from '@/store/slices/files';
import { selectActiveConvoId } from '@/store/slices/shared';
import { removeFolder, unpinFile } from '@/store/thunks/files';
import { closeModal } from '@/store/thunks/modals';
import { isFolder } from '@/utils/files';

import styles from './DeleteFileModal.module.less';

const DeleteFileModal = () => {
  const { t } = useAppTranslation();
  const dispatch = useAppDispatch();
  const activeConvoId = useAppSelector(selectActiveConvoId);
  const fileManagementEnabled = useFeature('FileManagement');
  const currentDeletingItemId = useAppSelector(selectActiveSelectedFileItemId);
  const currentDeletingItem = useAppSelectorExtra(
    fileManagementEnabled ? selectActiveFileItemById : selectActiveLegacyFileItemById,
    currentDeletingItemId ?? ''
  );

  if (!currentDeletingItem) {
    return null;
  }

  const isItemAFolder = isFolder(currentDeletingItem);

  const handleClose = () => {
    dispatch(closeModal('DeleteFileModal'));
  };

  const handleSubmit = () => {
    isItemAFolder
      ? dispatch(removeFolder({ vgroupId: activeConvoId, folderId: currentDeletingItem.uuid }))
      : dispatch(unpinFile({ vgroupId: activeConvoId, fileId: currentDeletingItem.uuid }));
    dispatch(closeModal('DeleteFileModal'));
  };

  return (
    <Modal variant="alert" onClose={handleClose}>
      <ModalHeader title={t('FileManagement.AreYouSure')} />
      <ModalBody className={styles.deleteFileContent}>
        {isItemAFolder
          ? t('FileManagement.DeleteFolderFromRoom', { folderName: currentDeletingItem.name })
          : t(
              'The file {{filename}} will be removed from Files. If it was saved from a message, it will remain in the room until the message expires.',
              { filename: currentDeletingItem.name }
            )}
      </ModalBody>
      <ModalButtonGroup>
        <Button bordered onClick={handleClose}>
          {t('Cancel')}
        </Button>
        <PrimaryButton onClick={handleSubmit}>{t('Yes')}</PrimaryButton>
      </ModalButtonGroup>
    </Modal>
  );
};

export default DeleteFileModal;
