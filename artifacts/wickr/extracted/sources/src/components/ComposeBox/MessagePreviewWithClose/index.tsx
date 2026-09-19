import React, { useEffect } from 'react';
import { CloseIcon, IconButton, Tooltip } from '@/componentlibrary';
import { MessagePreview } from '@/components/Convo/MessagePreview';
import { useCachedMessage } from '@/lib/cache/useCachedMessage';
import { useAppTranslation } from '@/lib/i18n';
import { WickrMessageMentions } from '@/lib/protobuf/messages';
import { useAppDispatch, useAppSelector } from '@/store';
import { selectActiveConvoId } from '@/store/slices/shared';
import {
  clearDraftMessage,
  MessagePreviewType,
  selectActiveConvoDraftMessage,
  selectActiveReplyOrEditMsg,
  setActiveReplyOrEditMsg,
} from '@/store/slices/uiChat';

import styles from './MessagePreviewWithClose.module.less';

interface MessagePreviewWithCloseProps {
  onClose?: (type?: MessagePreviewType) => void;
  onMessageEdit?: (content: string, mentions?: WickrMessageMentions) => void;
}

const MessagePreviewWithClose: React.FC<MessagePreviewWithCloseProps> = (props) => {
  const { t } = useAppTranslation();
  const dispatch = useAppDispatch();
  const activeMsg = useAppSelector(selectActiveReplyOrEditMsg);
  const activeConvoId = useAppSelector(selectActiveConvoId);
  const message = useCachedMessage(activeConvoId, activeMsg?.msgId);
  const activeDraftMessage = useAppSelector(selectActiveConvoDraftMessage);
  const isEditMessage = activeMsg?.type === 'edit';

  const onClose = () => {
    if (isEditMessage && message?.vGroupID) {
      dispatch(clearDraftMessage({ vGroupId: message?.vGroupID }));
    }
    dispatch(setActiveReplyOrEditMsg());
    props.onClose?.(activeMsg?.type);
  };

  useEffect(() => {
    if (message && isEditMessage && !activeDraftMessage) {
      props.onMessageEdit?.(message.textContent, message.text?.mentionList);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [message?.textContent, isEditMessage]);

  if (!activeMsg || !message) {
    return null;
  }

  return (
    <div className={styles.messagePreviewContainer}>
      <MessagePreview message={message} type={activeMsg.type} />
      <Tooltip tip={t('Close')}>
        <IconButton label={t('Close')} onClick={onClose}>
          <CloseIcon />
        </IconButton>
      </Tooltip>
    </div>
  );
};

export default MessagePreviewWithClose;
