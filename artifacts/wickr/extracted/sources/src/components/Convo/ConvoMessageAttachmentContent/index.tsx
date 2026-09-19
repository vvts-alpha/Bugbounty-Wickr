import React from 'react';

import { Button, DocumentIcon } from '@/componentlibrary';
import { TranslationKey, isTranslationKey, useAppTranslation } from '@/lib/i18n';
import { WickrMessage, getMessageFilename } from '@/lib/protobuf/messages';
import { useAppDispatch, useAppSelector } from '@/store';
import { useSetting } from '@/store/hooks/useSetting';
import { selectActiveConvoHasUnauthorizedMembers } from '@/store/slices/convos/convosSelectors';
import { openFile } from '@/store/thunks/ui';
import { getFileExtension, isAllowedToOpenFile } from '@/utils/path';
import { capitalize, formatFileSize } from '@/utils/strings';

import styles from './styles.module.less';

interface ConvoMessageAttachmentContentProps {
  message: WickrMessage;
}

const ConvoMessageAttachmentContent: React.FC<ConvoMessageAttachmentContentProps> = ({
  message,
}) => {
  const dispatch = useAppDispatch();
  const { t } = useAppTranslation();
  let fileExt = 'Generic';
  let fileTypeString: TranslationKey = `Message.Attachment.GenericType`;

  const filename = getMessageFilename(message);
  const hasUnauthorizedMembers = useAppSelector(selectActiveConvoHasUnauthorizedMembers);
  const fileSize = message.file?.fileMetadata?.size;
  const isProd = useSetting('isProduction');
  const allowedToOpen = isAllowedToOpenFile(filename);
  const Tag = !isProd && !hasUnauthorizedMembers && allowedToOpen ? Button : 'div';

  if (filename?.includes('.')) {
    const tmpExt = getFileExtension(filename)?.toLowerCase() || 'file';
    const extString = capitalize(tmpExt);
    const typeString = `Message.Attachment.${extString}Type`;
    fileExt = tmpExt;

    if (isTranslationKey(typeString)) {
      fileTypeString = typeString as TranslationKey;
    }
  }

  const sizeText = `${formatFileSize(fileSize)} ${t(fileTypeString)}`;

  return (
    <Tag
      className={styles.attachmentFile}
      {...(Tag === Button
        ? {
            onClick: () => {
              dispatch(openFile({ messageId: message.msgId, vgroupId: message.vGroupID }));
            },
            wrapperClassName: styles.attachmentFileWrapper,
          }
        : {})}
    >
      <div>
        <DocumentIcon width="60" height="60" fileExt={fileExt} />
      </div>
      <div>
        <p>{filename}</p>
        <p>{sizeText}</p>
      </div>
    </Tag>
  );
};

export default ConvoMessageAttachmentContent;
