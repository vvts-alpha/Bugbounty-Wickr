import { ChangeEvent, SyntheticEvent, useState } from 'react';
import { FileApiErrorResponse } from '@/apis/webChannel/FileManagerWebChannel';
import {
  DocumentIcon,
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
import { selectUploadFileModalParams } from '@/store/slices/modal';
import { selectActiveConvoId } from '@/store/slices/shared';
import { pinNewFile } from '@/store/thunks/files';
import { closeModal } from '@/store/thunks/modals';
import { useHandleFileManagementApiError } from '@/utils/files';
import { getFileExtension } from '@/utils/path';

import styles from './UploadFileModal.module.less';

const UploadFileModal = () => {
  const { t } = useAppTranslation();
  const dispatch = useAppDispatch();
  const activeConvoId = useAppSelector(selectActiveConvoId);
  const currentFolderId = useAppSelector(selectActiveCurrentFolderId);
  const uploadFilename = useAppSelector(selectUploadFileModalParams).file;
  const handleError = useHandleFileManagementApiError();

  const [error, setError] = useState<string | undefined>(undefined);

  const getFilename = (path: string | undefined) => {
    return path?.split('/').pop() || '';
  };

  const [inputValue, setInputValue] = useState(getFilename(uploadFilename));

  const hasError = !!error;

  if (!uploadFilename) {
    return null;
  }

  const handleClose = () => {
    dispatch(closeModal('UploadFileModal'));
  };

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    setError(undefined);
    setInputValue(event.target.value);
  };

  const handleSubmit = (e: SyntheticEvent) => {
    e.preventDefault();
    dispatch(
      pinNewFile({
        vgroupId: activeConvoId,
        parentFolderId: currentFolderId,
        filePath: uploadFilename,
        fileAlias: inputValue,
      })
    )
      .unwrap()
      .then(handleClose, handleErrorMessage);
  };

  const handleErrorMessage = (response: FileApiErrorResponse) => {
    const errorString = handleError(response, false);
    if (errorString) setError(errorString);
  };

  const fileExt = getFileExtension(getFilename(uploadFilename))?.toLowerCase() || 'file';

  return (
    <Modal closeLabel={t('Close')} onClose={handleClose}>
      <ModalHeader title={t('FileManagement.UploadAFile')} />
      <ModalBody>
        <form className={styles.newFileContent} onSubmit={handleSubmit}>
          <div className={styles.iconContainer}>
            <DocumentIcon width={40} height={40} fileExt={fileExt} />
          </div>
          <FormField
            fieldName="input"
            fieldProps={{
              showClear: false,
            }}
            label={t('FileManagement.Filename')}
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
        <PrimaryButton onClick={handleSubmit}>{t('FileManagement.Upload')}</PrimaryButton>
      </ModalButtonGroup>
    </Modal>
  );
};

export default UploadFileModal;
