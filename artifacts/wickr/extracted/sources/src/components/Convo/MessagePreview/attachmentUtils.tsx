import { wickrWebEndpoints } from '@/apis/webFetch/endpoints';
import { DocumentIcon, PlayIcon } from '@/componentlibrary';
import { AppTranslation, isTranslationKey, TranslationKey } from '@/lib/i18n';
import {
  getMessageFilename,
  messageHasAudioMetadata,
  messageHasImageAttachment,
  WickrMessage,
  WickrMessageType,
} from '@/lib/protobuf/messages';
import { toDurationString } from '@/utils/date';
import { getFileExtension } from '@/utils/path';
import { capitalize, formatFileSize } from '@/utils/strings';

export interface AttachmentPreview {
  name?: string | null;
  imgSrc?: string;
  icon?: JSX.Element;
  size?: string;
  type?: string;
}

const ONE_HOUR_MS = 10 * 100 * 60 * 60;

export const getAttachmentPreview = (
  t: AppTranslation,
  message?: WickrMessage
): AttachmentPreview | undefined => {
  if (message?.type !== WickrMessageType.MsgType_File_FileShare) {
    return;
  }
  const filename = getMessageFilename(message);
  let fileExt = 'Generic';
  let fileTypeString: TranslationKey = `Message.Attachment.GenericType`;

  if (filename?.includes('.')) {
    const tmpExt = getFileExtension(filename)?.toLowerCase() || 'file';
    const extString = capitalize(tmpExt);
    const typeString = `Message.Attachment.${extString}Type`;
    fileExt = tmpExt;

    if (isTranslationKey(typeString)) {
      fileTypeString = typeString as TranslationKey;
    }
  }

  if (messageHasAudioMetadata(message)) {
    const duration = message.file.audioMetadata.duration ?? 0;
    const durationString = toDurationString(duration, { showHour: duration > ONE_HOUR_MS });
    return {
      name: t('Voice Memo ({{duration}})', { duration: durationString }),
      icon: <PlayIcon size="2.5em" />,
    };
  } else if (messageHasImageAttachment(message)) {
    // For forwarded messages, use the original message's vGroupID and msgId if available
    // to ensure the image URL remains stable across message state transitions
    const forwardedMsg = message.forwardMessage;
    const imageVGroupID = forwardedMsg?.vGroupID || message.vGroupID;
    const imageMsgID = forwardedMsg?.msgID || message.msgId;

    return {
      name: filename,
      imgSrc: wickrWebEndpoints.messageImage(imageVGroupID, imageMsgID),
    };
  } else {
    const fileExt = getFileExtension(filename)?.toLowerCase() || 'file';
    return {
      name: filename,
      icon: <DocumentIcon width="2.5em" height="2.5em" fileExt={fileExt} />,
      size: formatFileSize(message.file?.fileMetadata?.size),
      type: t(fileTypeString),
    };
  }
};
