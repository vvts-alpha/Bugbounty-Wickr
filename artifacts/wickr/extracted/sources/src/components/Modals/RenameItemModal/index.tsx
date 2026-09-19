import { ChangeEvent, SyntheticEvent, useState } from 'react';
import { FileApiErrorResponse } from '@/apis/webChannel/FileManagerWebChannel';
import {
  DocumentIcon,
  FolderIcon,
  FormField,
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
import { renameFile, renameFolder } from '@/store/thunks/files';
import { closeModal } from '@/store/thunks/modals';
import { isFolder, useHandleFileManagementApiError } from '@/utils/files';
import { getFileExtension } from '@/utils/path';

import styles from './RenameItemModal.module.less';

const RenameItemModal = () => {
  const { t } = useAppTranslation();
  const dispatch = useAppDispatch();
  const activeConvoId = useAppSelector(selectActiveConvoId);
  const fileManagementEnabled = useFeature('FileManagement');
  const currentRenamingItemId = useAppSelector(selectActiveSelectedFileItemId);
  const currentRenamingItem = useAppSelectorExtra(
    fileManagementEnabled ? selectActiveFileItemById : selectActiveLegacyFileItemById,
    currentRenamingItemId ?? ''
  );
  const handleError = useHandleFileManagementApiError();

  const [inputValue, setInputValue] = useState(currentRenamingItem?.name ?? '');
  const [error, setError] = useState<string | undefined>(undefined);

  const hasError = !!error;

  if (!currentRenamingItem) {
    return null;
  }

  const isItemAFolder = isFolder(currentRenamingItem);

  const handleClose = () => {
    dispatch(closeModal('RenameFileModal'));
  };

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    setError(undefined);
    setInputValue(event.target.value);
  };

  const handleSubmit = (e: SyntheticEvent) => {
    e.preventDefault();
    isItemAFolder
      ? dispatch(
          renameFolder({
            vgroupId: activeConvoId,
            folderId: currentRenamingItem.uuid,
            folderName: inputValue.trim(),
          })
        )
          .unwrap()
          .then(handleClose, handleErrorMessage)
      : dispatch(
          renameFile({
            vgroupId: activeConvoId,
            fileId: currentRenamingItem.uuid,
            existingFilename: currentRenamingItem.name,
            newFilename: inputValue.trim(),
          })
        )
          .unwrap()
          .then(handleClose, handleErrorMessage);
  };

  const handleErrorMessage = (response: FileApiErrorResponse) => {
    const errorString = handleError(response, isFolder(currentRenamingItem));
    if (errorString) setError(errorString);
  };

  const fileExt = getFileExtension(currentRenamingItem.name)?.toLowerCase() || 'file';

  return (
    <Modal closeLabel={t('Close')} onClose={handleClose}>
      <ModalHeader
        title={t(isItemAFolder ? 'FileManagement.RenameFolder' : 'FileManagement.RenameFile')}
      />
      <ModalBody>
        <form className={styles.content} onSubmit={handleSubmit}>
          <div className={styles.iconContainer}>
            {isItemAFolder ? (
              <FolderIcon width={40} height={40} />
            ) : (
              <DocumentIcon fileExt={fileExt} width={40} height={40} />
            )}
          </div>
          <FormField
            fieldName="input"
            fieldProps={{
              showClear: false,
            }}
            label={t(isItemAFolder ? 'FileManagement.FolderName' : 'FileManagement.Filename')}
            onChange={handleInputChange}
            value={inputValue}
            hasError={hasError}
            errorContent={error}
          />
        </form>
      </ModalBody>
      <ModalButtonGroup>
        <Button onClick={handleClose}>{t('Cancel')}</Button>
        <PrimaryButton onClick={handleSubmit}>{t('FileManagement.Rename')}</PrimaryButton>
      </ModalButtonGroup>
    </Modal>
  );
};

export default RenameItemModal;
