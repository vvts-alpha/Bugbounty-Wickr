import { wickrWebEndpoints } from '@/apis/webFetch/endpoints';
import {
  CloseIcon,
  IconButton,
  Modal,
  ModalBody,
  MoreIcon,
  PopOver,
  PopOverItem,
} from '@/componentlibrary';
import SafeImage from '@/components/SafeImage';
import { useAppTranslation } from '@/lib/i18n';
import { getMessageFilename } from '@/lib/protobuf/messages';
import { useAppDispatch, useAppSelector, useAppSelectorExtra } from '@/store';
import { useSetting } from '@/store/hooks/useSetting';
import { selectActiveConvoHasUnauthorizedMembers } from '@/store/slices/convos/convosSelectors';
import { selectFileItemByConvoIdFileId } from '@/store/slices/files';
import { selectViewImageModalParams } from '@/store/slices/modal';
import { selectActiveConvoId } from '@/store/slices/shared';
import { closeModal } from '@/store/thunks/modals';
import { openFile, saveFile } from '@/store/thunks/ui';

import styles from './styles.module.less';

const ViewImageModal = () => {
  const dispatch = useAppDispatch();
  const { t } = useAppTranslation();
  const { file, message } = useAppSelector(selectViewImageModalParams);
  const fileId = file?.uuid || '';
  const messageId = message?.msgId ?? '';
  const vgroupId = useAppSelector(selectActiveConvoId);
  const fileData = useAppSelectorExtra(selectFileItemByConvoIdFileId, vgroupId, fileId);
  const imgSrc = messageId
    ? wickrWebEndpoints.messageImage(vgroupId, messageId)
    : wickrWebEndpoints.fileDataFromFileManager(fileId);
  const filename = message ? getMessageFilename(message) : fileData?.name;
  const enableFileDownload = useSetting('enableFileDownload');
  const hasUnauthorizedMembers = useAppSelector(selectActiveConvoHasUnauthorizedMembers);

  const handleClose = () => dispatch(closeModal('ViewImageModal'));

  const menuItems = (
    <>
      <PopOverItem
        onClick={() => {
          if (message) dispatch(openFile({ vgroupId, messageId }));
        }}
      >
        <>{t('Message.Menu.Open')}</>
      </PopOverItem>
      <PopOverItem
        onClick={() => {
          if (message) dispatch(saveFile({ vgroupId, messageId }));
        }}
      >
        <>{t('Message.Menu.SaveAs')}</>
      </PopOverItem>
    </>
  );
  return (
    <Modal onClose={handleClose} size="xl" closeLabel={t('Close')}>
      <header className={styles.header}>
        <IconButton label={t('Close')} onClick={handleClose}>
          <CloseIcon size="20px" />
        </IconButton>
        <h2 className={styles.imgTitle}>{filename}</h2>
        {enableFileDownload && !hasUnauthorizedMembers && (
          <span className={styles.menuBtn}>
            <PopOver popoverContent={menuItems}>
              <IconButton label={t('Message.Menu.OpenMenu')}>
                <MoreIcon />
              </IconButton>
            </PopOver>
          </span>
        )}
      </header>
      <ModalBody className={styles.modalBody}>
        <SafeImage src={imgSrc} wrapperClassName={styles.imgWrapper} className={styles.img} />
      </ModalBody>
    </Modal>
  );
};

export default ViewImageModal;
