import { clsx } from 'clsx';
import prettyBytes from 'pretty-bytes';
import { MouseEvent, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { generateChatRoute } from '@/chat/routes';
import {
  CloseIcon,
  DocumentIcon,
  FolderIcon,
  IconButton,
  MoreIcon,
  PopOver,
  PopOverItem,
  PopOverSeparator,
  MoveIcon,
  OpenFolderIcon,
} from '@/componentlibrary';
import usePrevious from '@/hooks/usePrevious';
import { useAppTranslation } from '@/lib/i18n';
import { INVALID_FILE_ITEM, SAVED_ITEMS_UUID, WickrFileItem } from '@/lib/protobuf/files';
import { imageFileExtPreviewSupported } from '@/lib/protobuf/messages';
import { useAppDispatch, useAppSelector } from '@/store';
import { useSetting } from '@/store/hooks/useSetting';
import {
  selectActiveConvoCanModifyPinnedFilesLinks,
  selectActiveConvoHasUnauthorizedMembers,
} from '@/store/slices/convos';
import {
  selectActiveCurrentFolderId,
  selectActiveRootFolderId,
  setSelectedFileItemId,
} from '@/store/slices/files';
import { pushModal } from '@/store/slices/modal';
import { selectActiveConvoId } from '@/store/slices/shared';
import {
  cancelDownload,
  cancelPinNewFile,
  downloadPinnedFile,
  fetchFolder,
  openPinnedFile,
} from '@/store/thunks/files';
import { openAlertModal, openModal } from '@/store/thunks/modals';
import { formatTimestampToDate } from '@/utils/date';
import { isElement } from '@/utils/dom';
import { isFolder, isLegacyFolder } from '@/utils/files';
import { getFileExtension, isAllowedToOpenFile } from '@/utils/path';
import { copyTextToClipboard } from '@/utils/strings';

import styles from './styles.module.less';

export interface FileManagementItemProps {
  item: WickrFileItem;
  /** Optional behavior when the item is clicked */
  onClick?: () => void;
  /** If this is being used in the file system preview, eg. in the move file modal */
  isPreview?: boolean;
  /** If this item should be disabled */
  disabled?: boolean;
}

const FileManagementItem = ({
  item,
  onClick,
  isPreview = false,
  disabled = false,
}: FileManagementItemProps) => {
  const { t } = useAppTranslation();
  const dispatch = useAppDispatch();
  const activeConvoId = useAppSelector(selectActiveConvoId);
  const rootFolderId = useAppSelector(selectActiveRootFolderId);
  const isAllowedToOpen = isAllowedToOpenFile(item.name);
  const canModifyPinnedFilesLinks = useAppSelector(selectActiveConvoCanModifyPinnedFilesLinks);
  const currentFolderId = useAppSelector(selectActiveCurrentFolderId);
  const [shouldShowProgressBar, setShouldShowProgressBar] = useState(false);
  const [shouldShowStatusText, setShouldShowStatusText] = useState(false);
  const enableFileDownload = useSetting('enableFileDownload');
  const hasUnauthorizedMembers = useAppSelector(selectActiveConvoHasUnauthorizedMembers);
  const shouldShowMenuOnClick = !isAllowedToOpen && !isFolder(item) && enableFileDownload;
  const isTransferring =
    item.status === 'initializing' ||
    item.status === 'initialized' ||
    item.status === 'uploading' ||
    item.status === 'downloading';
  const previousStatus = usePrevious(item.status, true);
  const statusText = useMemo(() => {
    switch (item.status) {
      case 'initializing':
      case 'initialized':
      case 'uploading':
        return t('FileManagement.Uploading');
      case 'downloading':
        return t('FileManagement.Exporting');
      case 'complete':
      case 'canceled':
        if (previousStatus === 'uploading') {
          return t('FileManagement.UploadStatus', { status: item.status });
        } else if (previousStatus === 'downloading') {
          return t('FileManagement.ExportStatus', { status: item.status });
        }
        return;
      default:
        return;
    }
  }, [item.status]);
  const isUploading = useMemo(() => {
    switch (item.status) {
      case 'initializing':
      case 'initialized':
      case 'uploading':
        return true;
      case 'complete':
      case 'canceled':
        if (previousStatus === 'uploading') {
          return true;
        }
        return false;
      default:
        return false;
    }
  }, [item.status]);

  const handleOpenFile = () => {
    if (hasUnauthorizedMembers) return;
    if (enableFileDownload) {
      dispatch(openPinnedFile({ fileId: item.uuid, vgroupId: activeConvoId }));
    } else if (imageFileExtPreviewSupported(fileExt)) {
      dispatch(
        openModal({
          name: 'ViewImageModal',
          params: {
            file: item,
          },
        })
      );
    } else {
      dispatch(
        pushModal({
          name: 'FilePreviewModal',
          params: {
            file: item,
          },
        })
      );
    }
  };

  const handleClick = (e: React.MouseEvent) => {
    if (isElement(e.target)) {
      if (e.target.getAttribute('aria-disabled') === 'true') {
        return;
      }
    }
    if (shouldShowProgressBar || hasUnauthorizedMembers) {
      return;
    }

    if (onClick) return onClick();

    if (!isFolder(item) && isAllowedToOpen) {
      handleOpenFile();
    }
  };

  const fileExt = getFileExtension(item.name)?.toLowerCase() || 'file';
  const icon = isFolder(item) ? (
    <FolderIcon savedItems={item.uuid === SAVED_ITEMS_UUID} />
  ) : (
    <DocumentIcon fileExt={fileExt} />
  );

  useEffect(() => {
    if (isTransferring) {
      setShouldShowProgressBar(true);
      setShouldShowStatusText(true);
    } else if (item.status === 'complete') {
      // Show completed status text and progress bar for 2 seconds
      const progressBarTimeout = setTimeout(() => {
        setShouldShowProgressBar(false);
        setShouldShowStatusText(false);
        dispatch(fetchFolder({ vgroupId: activeConvoId, folderId: currentFolderId }));
      }, 2000);
      return () => clearTimeout(progressBarTimeout);
    } else if (item.status === 'canceled') {
      // Remove progress bar when canceled
      setShouldShowProgressBar(false);
      // Show canceled status text for 2 seconds
      const statusTextTimeout = setTimeout(() => {
        setShouldShowStatusText(false);
        dispatch(fetchFolder({ vgroupId: activeConvoId, folderId: currentFolderId }));
      }, 2000);
      return () => clearTimeout(statusTextTimeout);
    }
  }, [item.status]);

  const handleRenameItemClick = (e: MouseEvent<HTMLElement>) => {
    e.preventDefault();
    if (hasUnauthorizedMembers) return;
    dispatch(setSelectedFileItemId({ vgroupId: activeConvoId, fileId: item.uuid }));
    dispatch(pushModal('RenameFileModal'));
  };

  const handleSaveAsClick = (e: any) => {
    e.preventDefault();
    if (hasUnauthorizedMembers) return;
    dispatch(downloadPinnedFile({ vgroupId: activeConvoId, fileId: item.uuid }));
  };

  const handleMoveItemClick = (e: MouseEvent<HTMLElement>) => {
    e.preventDefault();
    if (hasUnauthorizedMembers) return;
    dispatch(setSelectedFileItemId({ vgroupId: activeConvoId, fileId: item.uuid }));
    dispatch(pushModal('MoveFileModal'));
  };

  const handleDeleteItemClick = (e: MouseEvent<HTMLElement>) => {
    e.preventDefault();
    if (hasUnauthorizedMembers) return;
    dispatch(setSelectedFileItemId({ vgroupId: activeConvoId, fileId: item.uuid }));
    dispatch(pushModal('DeleteFileModal'));
  };

  const folderName = isLegacyFolder(item) ? t('FileManagement.SavedFromMessages') : item.name;

  const handleCopyNameClick = (e: MouseEvent<HTMLElement>) => {
    e.preventDefault();
    copyTextToClipboard(folderName);
  };

  const handleCancelClick = () => {
    if (item.status === 'uploading') {
      dispatch(cancelPinNewFile({ fileId: item.uuid }));
    } else if (item.status === 'downloading') {
      dispatch(cancelDownload({ fileId: item.uuid }));
    }
  };

  const folderPath = generateChatRoute.convo(activeConvoId, 'files', { folderId: item.uuid });

  const renderFileMenu = () => [
    isAllowedToOpen && !hasUnauthorizedMembers && (
      <PopOverItem icon={<OpenFolderIcon />} onClick={handleOpenFile} key={'OpenFile'}>
        {t('FileManagement.OpenFile')}
      </PopOverItem>
    ),
    canModifyPinnedFilesLinks && !hasUnauthorizedMembers && (
      <PopOverItem icon={<MoveIcon />} onClick={handleMoveItemClick} key={'Move'}>
        {t('FileManagement.Move')}
      </PopOverItem>
    ),
    (isAllowedToOpen || canModifyPinnedFilesLinks) && !hasUnauthorizedMembers && (
      <PopOverSeparator key={'Separator1'} />
    ),
    <PopOverItem onClick={handleCopyNameClick} key={'CopyFilename'}>
      {t('FileManagement.CopyFilename')}
    </PopOverItem>,
    canModifyPinnedFilesLinks &&
      currentFolderId !== SAVED_ITEMS_UUID &&
      !hasUnauthorizedMembers && (
        <PopOverItem onClick={handleRenameItemClick} key={'Rename'}>
          {t('FileManagement.Rename')}
        </PopOverItem>
      ),
    enableFileDownload && !hasUnauthorizedMembers && (
      <>
        <PopOverSeparator key={'Separator2'} />
        <PopOverItem key={'SaveAs'} onClick={handleSaveAsClick}>
          {t('FileManagement.SaveAs')}
        </PopOverItem>
      </>
    ),
    canModifyPinnedFilesLinks && <PopOverSeparator key={'Separator3'} />,
    canModifyPinnedFilesLinks && !hasUnauthorizedMembers && (
      <PopOverItem variant="alert" onClick={handleDeleteItemClick} key={'Delete'}>
        {t('Remove From Files')}
      </PopOverItem>
    ),
    !isProd && (
      <PopOverItem
        onClick={() => {
          dispatch(
            openAlertModal({
              title: 'File Debug Information (alpha/beta)',
              body: Object.entries(item)
                .map(([key, value]) => `${key}: ${value}`)
                .join('\n'),
            })
          );
        }}
        key="DebugInfo"
      >
        {t('Show Debug Info')}
      </PopOverItem>
    ),
    __DEV__ && (
      <PopOverItem
        icon={<DocumentIcon />}
        onClick={() =>
          dispatch(
            pushModal({
              name: 'FilePreviewModal',
              params: {
                file: item,
              },
            })
          )
        }
      >
        Open File Preview (dev)
      </PopOverItem>
    ),
  ];

  const renderFolderMenu = () => [
    <PopOverItem icon={<OpenFolderIcon />} linkTo={folderPath} key={'OpenFolder'}>
      {t('FileManagement.OpenFolder')}
    </PopOverItem>,
    canModifyPinnedFilesLinks && !isLegacyFolder(item) && !hasUnauthorizedMembers && (
      <PopOverItem icon={<MoveIcon />} onClick={handleMoveItemClick} key={'Move'}>
        {t('FileManagement.Move')}
      </PopOverItem>
    ),
    <PopOverSeparator key={'Separator1'} />,
    <PopOverItem onClick={handleCopyNameClick} key={'CopyFolderName'}>
      {t('FileManagement.CopyFolderName')}
    </PopOverItem>,
    canModifyPinnedFilesLinks && !isLegacyFolder(item) && !hasUnauthorizedMembers && (
      <PopOverItem onClick={handleRenameItemClick} key={'Rename'}>
        {t('FileManagement.Rename')}
      </PopOverItem>
    ),
    canModifyPinnedFilesLinks && !isLegacyFolder(item) && !hasUnauthorizedMembers && (
      <PopOverSeparator key={'Separator2'} />
    ),
    canModifyPinnedFilesLinks && !isLegacyFolder(item) && !hasUnauthorizedMembers && (
      <PopOverItem variant="alert" onClick={handleDeleteItemClick} key={'Delete'}>
        {t('Remove From Files')}
      </PopOverItem>
    ),
  ];

  const isProd = useSetting('isProduction');
  if (isProd && item.name.startsWith(INVALID_FILE_ITEM)) {
    // hide invalid file items in prod
    return null;
  }

  const content = (
    <>
      <span
        className={clsx(styles.icon, {
          [styles.savedItems]: item.uuid === SAVED_ITEMS_UUID,
        })}
      >
        {icon}
      </span>
      <span className={styles.titleWrapper}>
        <div
          className={clsx(styles.filename, {
            [styles.titleWithProgressBar]: shouldShowProgressBar,
          })}
        >
          <span className={styles.title}>{folderName}</span>
          {shouldShowStatusText && (
            <span
              className={clsx(styles.transferringStatus, {
                [styles.transferCompleted]: !isTransferring,
              })}
            >
              {statusText}
            </span>
          )}
        </div>
        {shouldShowProgressBar && (
          <div className={styles.progressBar}>
            <div
              className={styles.progressFill}
              style={{
                width: `${Math.floor((item.progress || 0) * 100)}%`,
              }}
            />
          </div>
        )}
      </span>
      {!isPreview && (
        <>
          <span className={styles.type}>
            {isFolder(item) ? t('FileManagement.Folder') : fileExt}
          </span>
          <span className={styles.date}>
            {item.modifiedTimestamp
              ? formatTimestampToDate(item.modifiedTimestamp, 'numeric', t)
              : '--'}
          </span>
          <span className={styles.size}>
            {isFolder(item) || isUploading ? '--' : prettyBytes(item.sizeInBytes ?? 0)}
          </span>
          <span className={styles.popover} />
        </>
      )}
    </>
  );

  const to = !isFolder(item) || isPreview || disabled ? undefined : folderPath;

  const popover = !shouldShowStatusText && !isPreview && (
    <PopOver
      iconGutter={true}
      contentWrapperClassName={styles.popoverWrapper}
      popoverContent={isFolder(item) ? renderFolderMenu : renderFileMenu}
    >
      <IconButton label={t('MoreOptions')}>
        <MoreIcon />
      </IconButton>
    </PopOver>
  );

  const wrappedContent = () => {
    return to ? (
      <Link to={to} className={styles.link}>
        {content}
      </Link>
    ) : (
      <button onClick={handleClick} className={styles.button} aria-disabled={disabled}>
        {content}
      </button>
    );
  };

  // VoiceOver cannot read <li> tags in the QT WebEngine
  return (
    <div
      className={clsx(styles.fileManagementItem, {
        [styles.disabledItem]: disabled,
      })}
    >
      {!isFolder(item) &&
      !isPreview &&
      !isAllowedToOpen &&
      !shouldShowProgressBar &&
      !hasUnauthorizedMembers ? (
        <>
          <PopOver
            triggerType={shouldShowMenuOnClick ? 'click' : 'contextmenu'}
            anchorTo="cursor"
            popoverContent={renderFileMenu}
          >
            {wrappedContent()}
          </PopOver>
          {popover}
        </>
      ) : (
        <>
          {wrappedContent()}
          {popover}
        </>
      )}
      {!isPreview &&
        shouldShowStatusText &&
        (item.status === 'uploading' || item.status === 'downloading') &&
        item.progress &&
        item.progress < 0.95 && (
          // Hide cancel button when 95% of the file is uploaded/downloaded to avoid the case
          // when file finished uploding/downloading but user thought they cancelled the action
          <div className={styles.cancelButton}>
            <IconButton onClick={handleCancelClick} label={t('Cancel')}>
              <CloseIcon />
            </IconButton>
          </div>
        )}
    </div>
  );
};

export default FileManagementItem;
