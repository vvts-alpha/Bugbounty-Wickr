import { useEffect, useState } from 'react';
import { useFilePreview } from '../../FilePreviewProvider';
import { getMessage, getUser } from '@/apis/webFetch';
import { CaretIcon, Heading, IconButton, Input, ZoomInIcon, ZoomOutIcon } from '@/componentlibrary';
import { useAppTranslation } from '@/lib/i18n';
import { getMessageFilename, WickrMessage } from '@/lib/protobuf/messages';
import { formatTimestampToDate } from '@/utils/date';
import { formatFileSize, getContactDisplayName } from '@/utils/strings';

import styles from './styles.module.less';

export const MAX_SCALE = 3;
export const MIN_SCALE = 1;

interface PreviewHeaderProps {
  scale?: number;
  currentPage: number;
  numPages: number;
  prevPage?: () => void;
  nextPage?: () => void;
  goToPage?: (page: number) => void;
  handleZoom?: (zoomIn: boolean) => void;
}

const PreviewHeader: React.FC<PreviewHeaderProps> = ({
  scale,
  currentPage,
  numPages,
  prevPage,
  nextPage,
  goToPage,
  handleZoom,
}) => {
  const { t } = useAppTranslation();
  const { vgroupId, msgId } = useFilePreview();
  const [message, setMessage] = useState<WickrMessage>();
  const [senderName, setSenderName] = useState<string>();
  const filename = getMessageFilename(message);
  const fileSize = message?.file?.fileMetadata?.size;

  useEffect(() => {
    const fetchMessage = async () => {
      const message = await getMessage(vgroupId, msgId);
      if (message) {
        setMessage(message);
        const user = await getUser(message.senderHash);
        setSenderName(getContactDisplayName(user));
      }
    };

    fetchMessage();
  }, [vgroupId, msgId]);

  return (
    <div className={styles.header}>
      <div className={styles.info}>
        {message && (
          <>
            <Heading level={2} className={styles.fileName}>
              {filename}
            </Heading>
            <Heading level={3} className={styles.fileInfo}>
              {t('Uploaded by {{senderName}}', { senderName })} |{' '}
              {formatTimestampToDate(message?.timeStamp || 0, 'numeric', t)} |{' '}
              {formatFileSize(fileSize)}
            </Heading>
          </>
        )}
      </div>

      <div className={styles.pageSelector}>
        {t('Page')}
        {prevPage && (
          <IconButton
            className={styles.buttons}
            label={t('Previous page')}
            onClick={prevPage}
            aria-disabled={currentPage <= 1}
          >
            <CaretIcon direction="left" />
          </IconButton>
        )}
        <Input
          onChange={(e) => {
            goToPage?.(parseInt(e.target.value));
          }}
          value={currentPage.toString()}
          className={styles.pageInput}
          min={1}
          max={numPages}
          showClear={false}
          tabIndex={-1}
          aria-disabled={!!goToPage}
        />
        <span> / {numPages}</span>
        {nextPage && (
          <IconButton
            className={styles.buttons}
            label={t('Next page')}
            onClick={nextPage}
            aria-disabled={currentPage >= numPages}
          >
            <CaretIcon direction="right" />
          </IconButton>
        )}
      </div>

      <div className={styles.controlButtons}>
        {handleZoom && (
          <>
            <IconButton
              className={styles.buttons}
              label={t('Zoom out')}
              onClick={() => handleZoom(false)}
              aria-disabled={!scale || scale <= MIN_SCALE}
            >
              <ZoomOutIcon />
            </IconButton>
            <IconButton
              className={styles.buttons}
              label={t('Zoom in')}
              onClick={() => handleZoom(true)}
              aria-disabled={!scale || scale >= MAX_SCALE}
            >
              <ZoomInIcon />
            </IconButton>
          </>
        )}
      </div>
    </div>
  );
};

export default PreviewHeader;
