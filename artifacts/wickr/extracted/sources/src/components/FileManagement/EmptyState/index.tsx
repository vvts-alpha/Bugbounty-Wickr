import { PrimaryButton, DocumentIcon, Heading } from '@/componentlibrary';
import { useAppTranslation } from '@/lib/i18n';

import { Logger } from '@/lib/logger';
import { SAVED_ITEMS_UUID } from '@/lib/protobuf/files';
import { useAppDispatch, useAppSelector } from '@/store';
import {
  selectActiveConvoHasUnauthorizedMembers,
  selectActiveConvoModeratorIds,
} from '@/store/slices/convos';
import { selectActiveCurrentFolderId } from '@/store/slices/files';
import { selectSelfUser } from '@/store/slices/identity';
import { pushModal } from '@/store/slices/modal';
import { showOpenDialog } from '@/store/thunks/files';

import styles from './EmptyState.module.less';

const logger = new Logger('EmptyState');

const EmptyState = () => {
  const { t } = useAppTranslation();
  const dispatch = useAppDispatch();
  const isSavedFromMessages = useAppSelector(selectActiveCurrentFolderId) === SAVED_ITEMS_UUID;
  const currentUserId = useAppSelector(selectSelfUser)?.id || '';
  const isModerator = useAppSelector(selectActiveConvoModeratorIds).includes(currentUserId);
  const hasUnauthorizedMembers = useAppSelector(selectActiveConvoHasUnauthorizedMembers);

  const handleUploadClick = async () => {
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

  const title = isSavedFromMessages
    ? t('FileManagement.EmptyStateTitleSavedFromMessages')
    : isModerator
    ? t('FileManagement.EmptyStateTitle')
    : t('FileManagement.EmptyStateTitleRestricted');

  const subtitle = isSavedFromMessages
    ? t('FileManagement.EmptyStateSubtitleSavedFromMessages')
    : isModerator
    ? t('FileManagement.EmptyStateSubtitle')
    : t('FileManagement.EmptyStateSubtitleRestricted');

  return (
    <div className={styles.emptyState}>
      <DocumentIcon width={'32px'} height={'32px'} empty />
      <Heading level={1} as={'h1'}>
        {title}
      </Heading>
      <div className={styles.subtitle}>{subtitle}</div>
      {isModerator && !isSavedFromMessages && !hasUnauthorizedMembers && (
        <PrimaryButton className={styles.button} onClick={handleUploadClick}>
          {t('FileManagement.UploadAFile')}
        </PrimaryButton>
      )}
    </div>
  );
};

export default EmptyState;
