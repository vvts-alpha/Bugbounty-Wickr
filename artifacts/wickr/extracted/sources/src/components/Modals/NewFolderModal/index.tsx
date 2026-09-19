import { ChangeEvent, SyntheticEvent, useEffect, useRef, useState } from 'react';
import { FileApiErrorResponse } from '@/apis/webChannel/FileManagerWebChannel';
import {
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
import { useAppDispatch, useAppSelector } from '@/store';
import { selectActiveCurrentFolderId } from '@/store/slices/files';
import { selectActiveConvoId } from '@/store/slices/shared';
import { createFolder } from '@/store/thunks/files';
import { closeModal } from '@/store/thunks/modals';
import { useHandleFileManagementApiError } from '@/utils/files';

import styles from './NewFolderModal.module.less';

const NewFolderModal = () => {
  const { t } = useAppTranslation();
  const dispatch = useAppDispatch();
  const activeConvoId = useAppSelector(selectActiveConvoId);
  const currentFolderId = useAppSelector(selectActiveCurrentFolderId);
  const handleError = useHandleFileManagementApiError();

  const [inputValue, setInputValue] = useState(t('FileManagement.UntitledFolder'));
  const [error, setError] = useState<string | undefined>(undefined);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.select();
    }
  }, []);

  const handleClose = () => {
    dispatch(closeModal('NewFolderModal'));
  };

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    setError(undefined);
    setInputValue(event.target.value);
  };

  const handleSubmit = async (e: SyntheticEvent) => {
    e.preventDefault();
    await dispatch(
      createFolder({
        vgroupId: activeConvoId,
        folderName: inputValue.trim(),
        parentFolderId: currentFolderId,
      })
    )
      .unwrap()
      .then(handleClose, handleErrorMessage);
  };

  const handleErrorMessage = (response: FileApiErrorResponse) => {
    const errorString = handleError(response, true);
    if (errorString) setError(errorString);
  };

  const hasError = !!error;

  return (
    <Modal closeLabel={t('Close')} onClose={handleClose}>
      <ModalHeader title={t('FileManagement.NewFolder')} />
      <ModalBody>
        <form className={styles.newFolderContent} onSubmit={handleSubmit}>
          <div className={styles.iconContainer}>
            <FolderIcon width={40} height={40} />
          </div>
          <FormField
            fieldName="input"
            fieldProps={{
              showClear: false,
              ref: inputRef,
            }}
            label={t('FileManagement.FolderName')}
            onChange={handleInputChange}
            value={inputValue}
            hasError={hasError}
            errorContent={error}
          />
        </form>
      </ModalBody>
      <ModalButtonGroup>
        <Button bordered onClick={handleClose}>
          {t('Cancel')}
        </Button>
        <PrimaryButton onClick={handleSubmit}>{t('FileManagement.Create')}</PrimaryButton>
      </ModalButtonGroup>
    </Modal>
  );
};

export default NewFolderModal;
