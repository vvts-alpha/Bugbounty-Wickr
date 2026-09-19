import { clsx } from 'clsx';
import { FC, useEffect } from 'react';
import { FileStatusChangedResult } from '@/apis/webChannel/BridgeWebChannel';
import { Banner, Button } from '@/componentlibrary';
import { useAppTranslation } from '@/lib/i18n';
import { useAppDispatch, useAppSelector } from '@/store';
import { clearFileTransferBanner, selectFileTransferBanners } from '@/store/slices/uiChat';
import { fileTransferAction } from '@/store/thunks/ui';

import styles from './styles.module.less';

export const CANCEL_BANNER_DISMISS_DELAY = 5_000;
interface FileBannerProps {
  file: FileStatusChangedResult;
}

const FileTransferBanner: FC<FileBannerProps> = ({ file }) => {
  const { t } = useAppTranslation();
  const dispatch = useAppDispatch();
  const { status, uuid, progress, fileName } = file;
  const showCancelButton =
    progress !== 1 && status !== 'canceled' && status !== 'error' && status !== 'uploadinterrupted';

  useEffect(() => {
    if (status === 'canceled' || status === 'error' || status === 'uploadinterrupted') {
      const timer = setTimeout(() => {
        dispatch(clearFileTransferBanner(uuid));
      }, CANCEL_BANNER_DISMISS_DELAY);
      return () => clearTimeout(timer);
    }
  }, [status]);

  const handleCancelClick = () => {
    dispatch(fileTransferAction({ uuid: uuid, action: 'cancel' }));
  };

  // Following QML logic for displaying error messages
  // source: https://code.amazon.com/packages/WickrDesktopApp/blobs/13d973dc55035cda27ec3b69b450893365153c68/--/clients/enterprise/qml/widgets/StandardFileProgressBar.qml#L131-L205
  let bannerContentText = '';
  if (status === 'error') {
    bannerContentText = `${t('File transfer error {{fileName}}', {
      fileName,
    })})}`;
  } else if (status === 'complete' || progress === 1) {
    bannerContentText = ` ${t('{{fileName}} Complete', {
      fileName,
    })}`;
  } else if (status === 'encrypting') {
    bannerContentText = `${t('Encrypting assets')}`;
  } else if (status === 'canceled') {
    bannerContentText = ` ${t('{{fileName}} Canceled', {
      fileName,
    })}`;
  } else if (status === 'initialized' && fileName !== '') {
    bannerContentText = `${t('Establishing file transfer for {{fileName}}', {
      fileName,
    })}`;
  } else if (status === 'downloading') {
    bannerContentText = `${t('Downloading {{fileName}}', {
      fileName,
    })} `;
  } else if (status === 'uploading') {
    bannerContentText = `${t('Uploading {{fileName}}', {
      fileName,
    })} `;
  } else if (status === 'uploadretrying') {
    bannerContentText = `${t(
      'Upload timeout, retrying {{fileName}} (max sessions, upload queued)',
      {
        fileName,
      }
    )}`;
  } else if (status === 'uploadinterrupted') {
    if (fileName.length > 0) {
      bannerContentText = `${t('Connection error, {{fileName}}', {
        fileName,
      })}`;
    } else {
      bannerContentText = `${t('Connection error, please try again later')}`;
    }
  }

  return (
    <Banner className={styles.progressBanner}>
      <div className={styles.bannerContent}>
        <div className={styles.bannerContentText}>{bannerContentText}</div>
        {showCancelButton && (
          <Button color="secondaryRed" onClick={handleCancelClick} className={styles.cancelButton}>
            {t('Cancel')}
          </Button>
        )}
      </div>
      <div className={styles.progressBar}>
        <div
          className={clsx(styles.progressFill, {
            [styles.canceledProgress]: status === 'canceled',
          })}
          style={{ width: `${Math.floor(progress * 100)}%` }}
        ></div>
      </div>
    </Banner>
  );
};

const FileTransferBanners: FC = () => {
  const fileTransferBanners = useAppSelector(selectFileTransferBanners);

  if (!fileTransferBanners.length) return null;

  return (
    <div className={styles.fileTransferBanner}>
      {fileTransferBanners.map((entry) => (
        <FileTransferBanner key={entry.uuid} file={entry} />
      ))}
    </div>
  );
};

export default FileTransferBanners;
