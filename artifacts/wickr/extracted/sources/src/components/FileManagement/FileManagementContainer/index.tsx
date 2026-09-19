import { useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router';
import { Breadcrumbs } from '../../Breadcrumbs';
import EmptyState from '../EmptyState';
import FileMangementItem from '../FileManagementItem';
import SortButtons from '../SortButtons';
import { generateChatRoute } from '@/chat/routes';
import {
  NewFolderIcon,
  Button,
  UploadFileIcon,
  List,
  Banner,
  Heading,
  PrimaryButton,
} from '@/componentlibrary';
import usePrevious from '@/hooks/usePrevious';
import { useAppTranslation } from '@/lib/i18n';
import { Logger } from '@/lib/logger';
import { SAVED_ITEMS_UUID } from '@/lib/protobuf/files';
import { useAppDispatch, useAppSelector } from '@/store';
import {
  selectActiveConvoCanModifyPinnedFilesLinks,
  selectActiveConvoHasUnauthorizedMembers,
} from '@/store/slices/convos';
import {
  selectActiveCurrentFileItems,
  selectActiveFilesSort,
  selectActiveCurrentFolderId,
  setCurrentFolderId,
  selectActiveRootFolderId,
  selectActiveCurrentFolderIsAtMaximumDepth,
} from '@/store/slices/files';
import { pushModal } from '@/store/slices/modal';
import { pushPanel } from '@/store/slices/panels';
import { selectActiveConvoId } from '@/store/slices/shared';
import { fetchFolder, showOpenDialog } from '@/store/thunks/files';
import { sortFiles } from '@/utils/files';

import styles from './styles.module.less';

const logger = new Logger('FileManagementContainer');

const FileManagementContainer = () => {
  const { t } = useAppTranslation();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const items = useAppSelector(selectActiveCurrentFileItems);
  const currentSort = useAppSelector(selectActiveFilesSort);
  const sortedItems = useMemo(() => sortFiles(items, currentSort), [items, currentSort]);
  const activeConvoId = useAppSelector(selectActiveConvoId);
  const currentFolderId = useAppSelector(selectActiveCurrentFolderId);
  const rootFolderId = useAppSelector(selectActiveRootFolderId);
  const canCreateNewFolder = !useAppSelector(selectActiveCurrentFolderIsAtMaximumDepth);
  const canModifyPinnedFilesLinks = useAppSelector(selectActiveConvoCanModifyPinnedFilesLinks);
  const hasUnauthorizedMembers = useAppSelector(selectActiveConvoHasUnauthorizedMembers);

  // eslint-disable-next-line no-restricted-syntax -- Set the currentFolderId in redux according to the url
  const folderIdParam = useParams()['itemId'];
  useEffect(() => {
    if (folderIdParam !== currentFolderId) {
      dispatch(
        setCurrentFolderId({ vgroupId: activeConvoId, currentFolderId: folderIdParam || '' })
      );
    }
  }, [folderIdParam, activeConvoId]);

  const prevFolderId = usePrevious(currentFolderId);
  useEffect(() => {
    if (prevFolderId === '' && currentFolderId === rootFolderId) {
      // if we just fetched '', don't fetch the root again
    } else {
      dispatch(fetchFolder({ vgroupId: activeConvoId, folderId: currentFolderId }));
    }
  }, [currentFolderId, activeConvoId, rootFolderId, prevFolderId]);

  const handleNewFolderClick = () => {
    if (hasUnauthorizedMembers) return;
    dispatch(pushModal('NewFolderModal'));
  };

  const handleUploadFileClick = async () => {
    if (hasUnauthorizedMembers) return;
    await dispatch(showOpenDialog())
      .unwrap()
      .then((file) => {
        if (file) {
          dispatch(pushModal({ name: 'UploadFileModal', params: { file } }));
        } else {
          logger.info('User canceled upload file selection');
        }
      });
  };

  const handleBreadcrumbClick = (folderId: string) => {
    if (folderId === rootFolderId) {
      navigate(generateChatRoute.convo(activeConvoId, 'files', { folderId: '' }));
    } else {
      navigate(generateChatRoute.convo(activeConvoId, 'files', { folderId }));
    }
  };

  const itemsExcludingSavedFromMessages = items.filter((item) => item.uuid !== SAVED_ITEMS_UUID);
  return (
    <div className={styles.fileManagementContainer}>
      {hasUnauthorizedMembers && (
        <Banner className={styles.unauthdUsersBanner}>
          <div>
            <Heading className={styles.bannerHeading} level={4}>
              {t('Unauthorized user in room')}
            </Heading>
            <p>
              {t(
                'An unauthorized user is present in the room. Messages cannot be sent until the user is removed by a moderator.'
              )}
            </p>
          </div>
          <PrimaryButton onClick={() => dispatch(pushPanel({ name: 'ViewUsersPanel' }))}>
            {t('View Users')}
          </PrimaryButton>
        </Banner>
      )}
      {canModifyPinnedFilesLinks &&
        currentFolderId !== SAVED_ITEMS_UUID &&
        !hasUnauthorizedMembers && (
          <div className={styles.stickyBanner} data-testid="file-sticky-banner">
            <div className={styles.bannerButtons}>
              <Button onClick={handleUploadFileClick}>
                <UploadFileIcon />
                {t('FileManagement.Upload')}
              </Button>
              {canCreateNewFolder && (
                <Button onClick={handleNewFolderClick}>
                  <NewFolderIcon />
                  {t('FileManagement.NewFolder')}
                </Button>
              )}
            </div>
          </div>
        )}
      <Breadcrumbs className={styles.breadcrumbs} onClick={handleBreadcrumbClick} />

      <List className={styles.list} aria-live="polite">
        {/* VoiceOver cannot read <li> tags in the QT WebEngine */}
        <div className={styles.headerRow}>
          <span className={styles.name}>
            <span className={styles.nameText}>
              {t('FileManagement.Name')}
              <SortButtons category="name" />
            </span>
          </span>
          <span className={styles.type}>
            {t('FileManagement.Type')}
            <SortButtons category="type" />
          </span>
          <span className={styles.date}>
            {t('FileManagement.LastModified')}
            <SortButtons category="modified" />
          </span>
          <span className={styles.size}>
            {t('FileManagement.Size')}
            <SortButtons category="size" />
          </span>
          {!hasUnauthorizedMembers && <span className={styles.popover}></span>}
        </div>
        {sortedItems.map((file) => (
          <FileMangementItem item={file} key={file.uuid} />
        ))}
        {!itemsExcludingSavedFromMessages.length && <EmptyState />}
      </List>
    </div>
  );
};

export default FileManagementContainer;
