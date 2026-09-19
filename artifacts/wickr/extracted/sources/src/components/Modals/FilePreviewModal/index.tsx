import { useEffect, useState, useCallback } from 'react';
import { IconButton, Modal, ModalBody, ModalHeader, PopOutIcon } from '@/componentlibrary';
import { lineClamp } from '@/componentlibrary/Utilities';
import { FilePreviewURLParams } from '@/file-preview/FilePreviewProvider';
import {
  determinePreviewThemeByFileExt,
  isSupportedPreviewFileType,
} from '@/file-preview/previews';
import { useAsyncEffect } from '@/hooks/useAsyncEffect';
import useEventListener from '@/hooks/useEventListener';
import { useAppTranslation } from '@/lib/i18n';
import { Logger } from '@/lib/logger';
import { imageFileExtPreviewSupported } from '@/lib/protobuf/messages';
import { useAppDispatch, useAppSelector, useAppSelectorExtra } from '@/store';
import { useAbortableDispatch } from '@/store/hooks/useAbortableDispatch';
import { useSetting } from '@/store/hooks/useSetting';
import { selectConvoMessage, selectConvoMessageFileMetadata } from '@/store/slices/convos';
import { selectFileItemByConvoIdFileId } from '@/store/slices/files';
import { selectFilePreviewModalParams } from '@/store/slices/modal';
import { selectActiveConvoId } from '@/store/slices/shared';
import { closeModal, openModal } from '@/store/thunks/modals';
import { openLink } from '@/store/thunks/ui';
import { getFileExtension } from '@/utils/path';

import styles from './styles.module.less';
import modalStyles from '@/componentlibrary/Modal/Modal.module.less';

const logger = new Logger('FilePreviewModal');

const FILE_PREVIEW_URL = 'file-preview.html';

const FilePreviewModal = () => {
  const dispatch = useAppDispatch();
  const abortableDispatch = useAbortableDispatch();
  const convoId = useAppSelector(selectActiveConvoId);
  const { t } = useAppTranslation();
  const { msgId = '', vgroupId = '', file } = useAppSelector(selectFilePreviewModalParams);
  const message = useAppSelectorExtra(selectConvoMessage, convoId, msgId);
  const theme = useSetting('theme');
  const fileId = file?.uuid ?? '';
  const fileManagementFileData = useAppSelectorExtra(
    selectFileItemByConvoIdFileId,
    convoId,
    fileId
  );
  const messageFileData = useAppSelectorExtra(selectConvoMessageFileMetadata, vgroupId, msgId);
  const filename = messageFileData?.name
    ? messageFileData.name
    : fileManagementFileData?.name ?? '';
  const fileExt = getFileExtension(filename);
  const modalTheme = determinePreviewThemeByFileExt(fileExt, theme);

  const params: FilePreviewURLParams = {
    fileExt,
    fileId: fileId ?? '',
    theme,
    vgroupId: vgroupId ?? '',
    msgId: msgId ?? '',
  };

  const [canOpen, setCanOpen] = useState(false);

  useAsyncEffect(async () => {
    if (isSupportedPreviewFileType(params.fileExt)) {
      setCanOpen(true);
      return;
    } else if (imageFileExtPreviewSupported(fileExt)) {
      dispatch(openModal({ name: 'ViewImageModal', params: { message } }));
      dispatch(closeModal('FilePreviewModal'));
      return;
    }

    try {
      await abortableDispatch(
        openModal({
          name: 'AlertModal',
          params: {
            title: t('Preview unavailable'),
            body: t(
              "This file type cannot be opened in Wickr. Please contact your network administrator for information about your network's file restrictions."
            ),
          },
        })
      );

      dispatch(closeModal('FilePreviewModal'));
      dispatch(closeModal('AlertModal'));
    } catch {
      // no-op
    }
  }, [params.fileExt]);

  const handleClose = () => dispatch(closeModal('FilePreviewModal'));

  const urlParams = new URLSearchParams(params);

  const previewUrl = `${FILE_PREVIEW_URL}#${urlParams.toString()}`;

  const handleIframeMessage = useCallback(
    (event: MessageEvent) => {
      if (event.data && typeof event.data === 'object' && event.origin === window.parent.origin) {
        switch (event.data.type) {
          case 'openLink':
            dispatch(openLink({ link: event.data.url, showConfirmation: true }));
            break;
          default:
            logger.info('Unknown message type from preview:', event.data.type);
        }
      }
    },
    [previewUrl]
  );

  useEventListener(window, 'message', handleIframeMessage);

  useEffect(() => {
    logger.info('Preview for:', filename, 'iframe URL:', previewUrl);
  }, [previewUrl]);

  return (
    canOpen && (
      <Modal closeLabel={t('Close')} onClose={handleClose} size="xl" className={modalTheme}>
        <ModalHeader>
          <h2 style={lineClamp(1)} className={modalStyles.headerText}>
            {filename}
          </h2>
          {__DEV__ && (
            <IconButton label="Pop out" iconSize="sm" onClick={() => (location.href = previewUrl)}>
              <PopOutIcon />
            </IconButton>
          )}
        </ModalHeader>
        <ModalBody className={styles.body}>
          <iframe src={previewUrl} />
        </ModalBody>
      </Modal>
    )
  );
};

export default FilePreviewModal;
