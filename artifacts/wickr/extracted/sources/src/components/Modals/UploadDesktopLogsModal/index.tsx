import { format } from 'date-fns';
import { useState } from 'react';
import { useWebChannel } from '@/apis/webChannel/context';
import { Modal, ModalBody, ModalButtonGroup, ModalHeader, Button } from '@/componentlibrary';
import { SpinnerIcon } from '@/componentlibrary/icons';
import { MarkdownText } from '@/components/MarkdownText';
import { useAppTranslation } from '@/lib/i18n';
import { useAppDispatch } from '@/store';
import { closeModal } from '@/store/thunks/modals';
import { uploadDesktopLogsWithDate } from '@/utils/logging/uploadLogs';
import { copyTextToClipboard } from '@/utils/strings';

import styles from './styles.module.less';

const UploadDesktopLogsModal = () => {
  const { t } = useAppTranslation();
  const dispatch = useAppDispatch();
  const { bridge } = useWebChannel();

  const [uploadId, setUploadId] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [isUploading, setIsUploading] = useState(false);

  let state;
  if (errorMessage) {
    state = 'error';
  } else if (uploadId) {
    state = 'success';
  } else if (isUploading) {
    state = 'loading';
  } else {
    state = 'select';
  }

  const handleClose = () =>
    dispatch(
      closeModal({
        name: 'UploadDesktopLogsModal',
        returnValue: uploadId || undefined,
      })
    );

  const handleSubmit = async () => {
    if (uploadId) {
      copyTextToClipboard(uploadId);
    }
    dispatch(
      closeModal({
        name: 'UploadDesktopLogsModal',
        returnValue: uploadId,
      })
    );
  };

  const handleUpload = async () => {
    setIsUploading(true);
    try {
      const id = await uploadDesktopLogsWithDate(selectedDate, bridge);
      setUploadId(id);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unknown error occurred');
    } finally {
      setIsUploading(false);
    }
  };

  const successBody = `Your desktop logs have been uploaded successfully.\n\nLog ID: ${uploadId}`;
  const errorBody = errorMessage || 'There was an error uploading your logs. Please try again';

  switch (state) {
    case 'select':
      return (
        <Modal variant="alert" onClose={handleClose} size="md">
          <ModalHeader title="Upload Desktop Logs" />
          <ModalBody className={styles.body}>
            <div className={styles.datePickerContainer}>
              <p>Select a date to upload desktop logs from:</p>
              <input
                type="date"
                value={format(selectedDate, 'yyyy-MM-dd')}
                onChange={(e) => setSelectedDate(new Date(e.target.value))}
                max={format(new Date(), 'yyyy-MM-dd')}
                className={styles.dateInput}
              />
            </div>
          </ModalBody>
          <ModalButtonGroup>
            <Button bordered onClick={handleClose}>
              {t('Cancel')}
            </Button>
            <Button color="primary" onClick={handleUpload}>
              Upload
            </Button>
          </ModalButtonGroup>
        </Modal>
      );
    case 'loading':
      return (
        <Modal variant="alert" onClose={handleClose} size="md">
          <ModalHeader title="Uploading desktop logs..." />
          <ModalBody className={styles.body}>
            <div className={styles.spinnerContainer}>
              <SpinnerIcon size="50px" />
            </div>
          </ModalBody>
        </Modal>
      );
    case 'success':
      return (
        <Modal variant="alert" onClose={handleClose} size="md">
          <ModalHeader title="Log Upload Successful" />
          <ModalBody className={styles.body}>
            <MarkdownText text={successBody} />
          </ModalBody>
          <ModalButtonGroup>
            <Button bordered onClick={handleClose}>
              {t('Close')}
            </Button>
            <Button color="primary" onClick={handleSubmit}>
              Copy & Close
            </Button>
          </ModalButtonGroup>
        </Modal>
      );
    case 'error':
      return (
        <Modal variant="alert" onClose={handleClose} size="md">
          <ModalHeader title="Log Upload Failed" />
          <ModalBody className={styles.body}>{errorBody}</ModalBody>
          <ModalButtonGroup>
            <Button color="red" onClick={handleClose}>
              {t('OK')}
            </Button>
          </ModalButtonGroup>
        </Modal>
      );
  }
};

export default UploadDesktopLogsModal;
