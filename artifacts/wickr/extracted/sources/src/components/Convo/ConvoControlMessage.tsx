import { MessageBody } from '@amzn/wickr-messaging-protocol-proto';
import { clsx } from 'clsx';
import { FC, HTMLProps, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { generateChatRoute } from '@/chat/routes';
import { Button, PopOver } from '@/componentlibrary';
import { useControlMessage } from '@/hooks/useControlMessage';
import { Logger } from '@/lib/logger';
import { SAVED_ITEMS_UUID } from '@/lib/protobuf/files';
import {
  WickrMessage,
  WickrMessageType,
  messageIsScreenshotControlMessage,
} from '@/lib/protobuf/messages';
import { useAppDispatch, useAppSelector } from '@/store';
import { useFeature } from '@/store/hooks/useFeature';
import { useSetting } from '@/store/hooks/useSetting';
import { selectActiveConvoId } from '@/store/slices/shared';
import { navigateToFile } from '@/store/thunks/files';
import { showMessageHistory } from '@/store/thunks/ui';
import { chatBubbleId } from './ConvoMessage';
import ConvoMessageContextMenuItems from './ConvoMessageContextMenuItems';
import MessageIntersectionObserver from './ConvoMessagesObservers/intersectionObserver/MessageIntersectionObserver';
import MessageReadObserver from './ConvoMessagesObservers/readObservers/MessageReadObserver';

import styles from './ConvoControlMessage.module.less';

const logger = new Logger('ConvoControlMessage');

interface ConvoControlMessageProps extends HTMLProps<HTMLElement> {
  message: WickrMessage;
}

const ConvoControlMessage: FC<ConvoControlMessageProps> = ({ message }) => {
  const dispatch = useAppDispatch();

  const convoId = useAppSelector(selectActiveConvoId);
  const fileManagementEnabled = useFeature('FileManagement');
  const navigate = useNavigate();

  const renderIcon = !messageIsScreenshotControlMessage(message);
  const isProd = useSetting('isProduction');

  const { Icon, text } = useControlMessage(message.vGroupID, message.msgId);
  const handleClick = async () => {
    const changesIncludeFileVault = message.control?.update?.changes?.includes(
      MessageBody.Control.Settings.Identifier.FILEVAULT
    );
    const fileAction = message.control?.update?.fileVaultInfo?.action?.[0];
    const shouldNavigateToFile =
      changesIncludeFileVault &&
      fileAction?.action === MessageBody.Control.FileMgtAction.ActionType.UPLOAD &&
      fileManagementEnabled;
    const shouldNavigateToSavedItems =
      changesIncludeFileVault &&
      fileAction?.action === MessageBody.Control.FileMgtAction.ActionType.SAVE &&
      fileManagementEnabled;

    if (shouldNavigateToFile && fileAction.fileGuid) {
      dispatch(navigateToFile({ vgroupId: convoId, fileId: fileAction.fileGuid }));
    } else if (shouldNavigateToSavedItems) {
      navigate(generateChatRoute.convo(convoId, 'files', { folderId: SAVED_ITEMS_UUID }));
    } else {
      dispatch(
        showMessageHistory({
          vgroupId: convoId,
          messageId: message.msgId,
        })
      );
    }
  };

  useEffect(() => {
    if (!text) {
      logger.error('Unhandled control message type', {
        vGroupId: message.vGroupID,
        msgId: message.msgId,
      });
    }
  }, [text]);

  const isClickable =
    message.type !== WickrMessageType.MsgType_Ctrl_DataRetentionPolicy &&
    message.type !== WickrMessageType.MsgType_KeyVerification;

  const WrappingEl = isClickable ? Button : 'div';

  const bubble = text ? (
    <div
      id={chatBubbleId(message.msgId)}
      key={message.msgId}
      className={clsx(styles.controlMessage, {
        [styles.external]: message.type === WickrMessageType.MsgType_Ctrl_DataRetentionPolicy,
      })}
      data-message-type={message.type}
      data-anchor-chat-bubble
    >
      <WrappingEl
        className={styles.wrappingElement}
        onClick={isClickable ? handleClick : undefined}
        data-testid="ctrlMsgWrappingEl"
      >
        {renderIcon && <Icon className={styles.icon} />}
        {text}
        <MessageReadObserver message={message} messageIsLocked={false} />
      </WrappingEl>
    </div>
  ) : (
    <div id={chatBubbleId(message.msgId)} data-message-type={message.type} data-anchor-chat-bubble>
      <MessageReadObserver message={message} messageIsLocked={false} />
    </div>
  );

  const renderBubbleWithPopOver = () => (
    <PopOver
      triggerType="contextmenu"
      iconGutter
      popoverContent={(event) => {
        // Check if the right-click target is within the chat bubble
        if (!(event?.target as Element)?.closest('[data-anchor-chat-bubble]')) return null;

        return <ConvoMessageContextMenuItems message={message} />;
      }}
    >
      {bubble}
    </PopOver>
  );

  return (
    <MessageIntersectionObserver message={message} messageIsLocked={false}>
      {isProd ? bubble : renderBubbleWithPopOver()}
    </MessageIntersectionObserver>
  );
};

export default ConvoControlMessage;
