import { ContactBackup, ConvoCollection } from '@amzn/wickr-messaging-protocol-proto';
import { clsx } from 'clsx';
import { ComponentProps, HTMLProps, forwardRef, useRef } from 'react';
import { useConvoMember } from '../../store/hooks/useConvoMembers';
import ErrorBoundary from '../Errors/ErrorBoundary';
import { CautionIcon, ChatBubble, PopOver } from '@/componentlibrary';
import { useResized } from '@/hooks/resizeObserver';
import useLatestCallback from '@/hooks/useLatestCallback';
import useMergeRefs from '@/hooks/useMergeRefs';
import { useAppTranslation } from '@/lib/i18n';
import { Logger } from '@/lib/logger';
import {
  INVALID_MESSAGE_BODY_PREFIX,
  WickrMessage,
  WickrMessageType,
  getMessageFilename,
  isForwardedMessage,
  isCallMessage,
  isFailedMessage,
  isFileShareMessage,
  isMessageSending,
  isTextMessage,
  messageHasAudioMetadata,
  messageHasFileMetadata,
  messageHasImageAttachment,
  messageHasImageMetadata,
} from '@/lib/protobuf/messages';
import { useAppDispatch, useAppSelector } from '@/store';
import { useFeature } from '@/store/hooks/useFeature';
import { useSetting } from '@/store/hooks/useSetting';
import {
  selectActiveConvoCanModifyPinnedFilesLinks,
  selectActiveConvoHasUnauthorizedMembers,
} from '@/store/slices/convos';
import { selectClientSynchronization } from '@/store/slices/uiChat';
import { emojiReact, markMessageRead } from '@/store/thunks/messages';
import { openModal } from '@/store/thunks/modals';
import { openLink } from '@/store/thunks/ui';
import { getHourCycle } from '@/utils/date';
import { copyImage } from '@/utils/dom';
import { getGoogleMapsLocationUrl } from '@/utils/geoLocation';
import { valueIfInstanceOf } from '@/utils/lang';
import { createRollingValueArray } from '@/utils/math';
import { isAllowedToOpenFile } from '@/utils/path';
import { getContactDisplayName, raw } from '@/utils/strings';
import { isEmailUrl } from '@/utils/url';
import ChatBubbleContainer from './ChatBubbleContainer';
import ConvoCallMessage from './ConvoCallMessage';
import ContentDisabledMessage from './ConvoMessage/ContentDisabledMessage';
import { ReactionLoadingType } from './ConvoMessage/CurrentMessageContext';
import ConvoMessageAttachmentContent from './ConvoMessageAttachmentContent';
import ConvoMessageAudioContent from './ConvoMessageAudioContent';
import ConvoMessageContextMenuItems, {
  ConvoMessageContextMenuItem,
} from './ConvoMessageContextMenuItems';
import ConvoMessageImageContent from './ConvoMessageImageContent';
import ConvoMessageLocationContent from './ConvoMessageLocationContent';
import ConvoMessageMetadata from './ConvoMessageMetadata';
import ConvoMessageTextContent from './ConvoMessageTextContent';
import MessageReadObserver from './ConvoMessagesObservers/readObservers/MessageReadObserver';
import ConvoTableMessage from './ConvoTableMessage';
import MessageReactions from './MessageReactions';

import styles from './Convo.module.less';

const logger = new Logger('ConvoMessage');

export type MessageVariant = 'incoming' | 'outgoing';

export interface BaseConvoMessageProps extends HTMLProps<HTMLElement> {
  id: string;
  showSenderName?: boolean;
  showAvatar?: boolean;
  isTableMessage?: boolean;
  isLastMessage?: boolean;
  isInteractive?: boolean;
  message: WickrMessage;
  convoType?: ConvoCollection.ConvoMeta.ConvoType;
  isHighlighted?: boolean;
  reactionsLoading?: Record<string, ReactionLoadingType>;
  isLocked?: boolean;
}

export type BaseConvoMessageImplProps = ComponentProps<typeof BaseConvoMessage>;

// Keep track of the latest widths to use for computing the max width of reactions
const latestWidths = createRollingValueArray(7, [210]);

export const chatBubbleContainerDOMId = (msgId: string) => `chat-bubble-container-${msgId}`;
export const chatBubbleDOMId = (msgId: string) => `chat-bubble-${msgId}`;

export const BaseConvoMessage = forwardRef<HTMLDivElement, BaseConvoMessageProps>(
  (
    {
      id,
      showSenderName,
      showAvatar,
      isTableMessage,
      isLastMessage,
      isInteractive,
      message,
      convoType,
      isHighlighted,
      reactionsLoading,
      isLocked,
    },
    ref
  ) => {
    const { t } = useAppTranslation();
    const variant = message.outbox ? 'outgoing' : 'incoming';
    const convoId = message.vGroupID;
    const dispatch = useAppDispatch();
    const sender = useConvoMember(convoId, message.senderHash);
    const senderName = getContactDisplayName(sender);
    const isClientSynced = useAppSelector(selectClientSynchronization);
    const messagesRightSide = useSetting('messagesRightSide');
    const reactions = message.reactions;
    const showMetadata = !isTableMessage;
    const filesEnabled = useSetting('filesEnabled');
    const textContentRef = useRef<HTMLDivElement>(null);
    const imgRef = useRef<HTMLImageElement>(null);
    const contentsRef = useRef<HTMLDivElement>(null);
    const filename = getMessageFilename(message);
    const isAllowedToOpen = isAllowedToOpenFile(filename);
    const isTranslationEnabled = useSetting('isTranslationEnabled');
    const isTranslationAvailable = useSetting('isTranslationAvailable');
    const isFailed = isFailedMessage(message);
    const isText = isTextMessage(message);
    const isFileShare = isFileShareMessage(message);
    const isCall = isCallMessage(message);
    const isSending = isMessageSending(message);
    const isForward = isForwardedMessage(message);
    const hasImageMetadata = messageHasImageMetadata(message);
    const contentDisabled = isFileShare ? !filesEnabled : false;
    const shouldShowMessageInfo = message.outbox;
    const isEnterprise = useSetting('isEnterprise');
    const use12HourFormat = useSetting('use12HourFormat');
    const hourCycle = getHourCycle(use12HourFormat);
    const canModifyPinnedFilesLinks = useAppSelector(selectActiveConvoCanModifyPinnedFilesLinks);
    const fileManagementEnabled = useFeature('FileManagement');
    const hasUnauthorizedMembers = useAppSelector(selectActiveConvoHasUnauthorizedMembers);

    // ConvoMessageLocationContent uses React.memo, so make this stable to prevent re-renders
    const handleClickLocationContent = useLatestCallback(() => {
      // Show location tile on enterprise, but open external link when clicked
      if (isEnterprise) {
        dispatch(
          openLink({
            link: getGoogleMapsLocationUrl(
              message.location?.latitude ?? 0,
              message.location?.longitude ?? 0
            ),
            showConfirmation: false,
          })
        );
        return;
      }

      dispatch(
        openModal({
          name: 'LocationModal',
          params: {
            type: 'view',
            msgId: message.msgId,
            vGroupId: message.vGroupID,
          },
        })
      );
    });

    const prependedText = t('Message.Copy.SenderInfo', {
      senderName,
      timestamp: message.timeStamp,
      formatParams: {
        timestamp: {
          hour: 'numeric',
          minute: '2-digit',
          hourCycle: hourCycle,
        },
      },
    });

    const handleCopyImage = () => {
      if (imgRef.current) {
        copyImage(imgRef.current);
      }
    };

    const handleClickToUnlock = () => {
      dispatch(
        markMessageRead({
          vgroupId: convoId,
          timeStamp: message.timeStampMicroseconds,
          messageId: message.msgId,
        })
      );
    };

    const onEmojiReaction = async (emoji: string) => {
      if (hasUnauthorizedMembers) return false;
      return await dispatch(
        emojiReact({
          emoji,
          messageId: message.msgId,
          vgroupId: message.vGroupID,
        })
      ).unwrap();
    };

    const onShowMoreReactions = () => {
      dispatch(
        openModal({
          name: 'ReactionsModal',
          params: {
            vgroupId: message.vGroupID,
            msgId: message.msgId,
          },
        })
      );
    };

    const showReactions =
      isInteractive &&
      !isLocked &&
      (reactions.length > 0 || (reactionsLoading && Object.keys(reactionsLoading).length > 0));

    const [setMetadataRef, metadataEntry] = useResized();
    const metadataWidth = metadataEntry?.contentRect.width;
    const [setBubbleRef, bubbleEntry] = useResized();
    const bubbleWidth = bubbleEntry?.contentRect.width;

    const bubbleRefs = useMergeRefs([ref, setBubbleRef]);

    // Calculate the width for message reactions between the left of the reactions container and the left
    // of the message metadata container. A minimum width must be applied for the reaction container to
    // be rendered to start with.
    const computedWidth = metadataWidth && bubbleWidth ? bubbleWidth - metadataWidth : 0;
    if (computedWidth) latestWidths.addValue(computedWidth);
    // use the computedWidth or fallback to the smallest known latest width
    const newWidth =
      showReactions && computedWidth > 0 ? computedWidth : Math.min(...latestWidths.values);

    const isProd = useSetting('isProduction');
    if (isProd && message.textContent.startsWith(INVALID_MESSAGE_BODY_PREFIX)) {
      // Messages that fail validation are given error content, but we want to hide them in prod
      // We still give them a div and an ID so that boundaries and such are not thrown off
      return <div id={chatBubbleContainerDOMId(id)} />;
    }

    const renderMessageContent = () => {
      if (isForward) {
        const forwardedRef = messageHasImageAttachment(message) ? imgRef : textContentRef;
        return (
          <ConvoMessageTextContent
            message={message}
            ref={forwardedRef}
            isInteractive={isInteractive}
          />
        );
      }

      // TODO: Move this to a separate component and use the useCurrentMessage to get the required message context
      const tableMeta = message.text?.tableMeta;
      if (tableMeta) {
        // When we get a table message (like from a bot) we get two chat bubbles
        // as a response: a single text message with the table name and
        // the message with the actual table.
        // isTableMessage is for the message that actually contains the table
        if (isTableMessage) {
          return (
            <ConvoTableMessage
              tableMeta={tableMeta}
              showActionButtons={isLastMessage}
              convoId={convoId}
            />
          );
        } else {
          return tableMeta.name;
        }
      }
      switch (message.type) {
        case WickrMessageType.MsgType_File_FileShare:
          if (messageHasImageAttachment(message)) {
            return (
              <ConvoMessageImageContent
                message={message}
                ref={imgRef}
                isInteractive={isInteractive}
              />
            );
          } else if (messageHasAudioMetadata(message)) {
            return <ConvoMessageAudioContent message={message} />;
          } else if (messageHasFileMetadata(message)) {
            return <ConvoMessageAttachmentContent message={message} />;
          }
          break;
        case WickrMessageType.MsgType_Call:
          return (
            message.callmessage && (
              <ConvoCallMessage
                msgId={message.msgId}
                convoId={convoId}
                callMessage={message.callmessage}
                senderUserName={message.senderUserName}
                variant={variant}
              />
            )
          );
        case WickrMessageType.MsgType_Location:
          return (
            <ConvoMessageLocationContent
              latitude={message.location?.latitude}
              longitude={message.location?.longitude}
              lastUpdated={message?.editTimestamp}
              shareExpiration={message.location?.shareExpiration}
              senderName={senderName}
              onClickLocation={isInteractive ? handleClickLocationContent : undefined}
            />
          );

        case WickrMessageType.MsgType_Text:
          return <ConvoMessageTextContent message={message} ref={textContentRef} />;
      }

      // not all the cases return, so put the fallback outside of the switch
      logger.error('Unknown message type; did not render', message.type, message.msgId);
      if (__DEV__) {
        return (
          <div>
            Unknown message type: {message.type}; msgId: {message.msgId}
          </div>
        );
      }
      return null;
    };

    const getContextMenuItems = (linkUrl: string | undefined): ConvoMessageContextMenuItem[] => {
      const readOnlyContextMenuItems = new Set<ConvoMessageContextMenuItem>([
        'showMessageInfo',
        'copyLink',
        'selectAll',
        'copyMessage',
        'report',
      ]);

      let contextMenuItems: ConvoMessageContextMenuItem[];

      if (isSending) {
        return [isText ? 'showMessageInfo' : undefined, !isClientSynced ? 'delete' : undefined];
      } else if (linkUrl && !isEmailUrl(linkUrl)) {
        // If right clicking directly on a link in a message
        contextMenuItems = [
          'starMessage',
          'copyLink',
          convoType === ConvoCollection.ConvoMeta.ConvoType.Room && canModifyPinnedFilesLinks
            ? 'saveLinkToRoom'
            : undefined,
          'selectAll',
          'editMessage',
          'replyToMessage',
          'forwardMessage',
          'showMessageInfo',
          'delete',
        ];
      } else {
        contextMenuItems = [
          message.reactions?.length ? 'reactions' : undefined,
          isFileShare && isAllowedToOpen ? 'open' : undefined,
          isFileShare && !fileManagementEnabled && canModifyPinnedFilesLinks
            ? 'saveToRoom'
            : undefined,
          isFileShare && fileManagementEnabled && canModifyPinnedFilesLinks
            ? 'saveToFiles'
            : undefined,
          isFileShare ? 'saveAs' : undefined,
          hasImageMetadata ? 'copyImage' : undefined,
          !isCall && !isFailed ? 'starMessage' : undefined,
          isText ? 'selectAll' : undefined,
          isText ? 'copyMessage' : undefined,
          variant === 'outgoing' && isText && !isFailed && !isForward ? 'editMessage' : undefined,
          !isCall ? 'forwardMessage' : undefined,
          !isCall && !isFailed ? 'replyToMessage' : undefined,
          isText && !message.outbox && isTranslationAvailable && !isForward
            ? isTranslationEnabled
              ? 'translateMessage'
              : 'enableMessageTranslation'
            : undefined,
          shouldShowMessageInfo ? 'showMessageInfo' : undefined,
          variant === 'incoming' ? 'report' : undefined,
          !isCall ? 'delete' : undefined,
          !isCall && isFailed ? 'resendMessage' : undefined,
          isFileShare ? 'openFilePreview' : undefined,
        ];
      }

      return hasUnauthorizedMembers
        ? contextMenuItems.filter((item) => readOnlyContextMenuItems.has(item))
        : contextMenuItems;
    };

    const chatBubble = (
      <ChatBubble
        data-anchor-chat-bubble // mark this component as an anchor point inside message component
        variant={variant}
        key={message.msgId}
        ref={bubbleRefs}
        locked={isLocked}
        onClickUnlock={handleClickToUnlock}
        className={clsx(styles.convoChatBubble, {
          [styles.chatBubbleWithLink]: !!message.text?.links,
          [styles.highlight]: isHighlighted,
          [styles.nonTextType]: !isText,
          [styles.tableMessage]: isTableMessage,
          [styles.stretchToFit]: !messagesRightSide,
          [styles.isInPanel]: !isInteractive,
        })}
        data-prepended-text={prependedText}
      >
        {contentDisabled ? (
          <div ref={contentsRef}>
            <MessageReadObserver message={message} messageIsLocked={false} />
            <ContentDisabledMessage />
          </div>
        ) : (
          <>
            {/* This div is necessary to keep the custom context menu functioning properly -
          see NewPopOver.tsx for details. It ensures that anything in renderMessageContent()
          will not have to spread props since the div below will cover it.
          */}
            <div ref={contentsRef}>
              <ErrorBoundary
                id="MessageContent"
                Fallback={({ error }) => (
                  <div className={styles.errorRendering}>
                    <p className={styles.errorLabel}>
                      <CautionIcon size={14} />{' '}
                      {/* TODO: get product text and use i18n */ raw('Error parsing message:')}
                    </p>
                    <p>{error.message}</p>
                  </div>
                )}
              >
                {renderMessageContent()}
              </ErrorBoundary>
              {/* This exists to prevent triple-click selection from expanding to subsequent messages
                  https://sim.amazon.com/issues/Wickr-14183 */}
              <div className={styles.emptyLine} aria-hidden>
                &nbsp;
              </div>
            </div>
            {isInteractive && (
              <MessageReadObserver message={message} messageIsLocked={!!isLocked} />
            )}
            {showReactions && (
              <MessageReactions
                maxWidth={newWidth}
                onEmojiReaction={onEmojiReaction}
                onShowMore={onShowMoreReactions}
                reactions={reactions}
                convoType={convoType}
              />
            )}
            <ConvoMessageMetadata
              ref={setMetadataRef}
              message={message}
              showMetadata={showMetadata}
              isLocked={isLocked}
              isInteractive={isInteractive}
              menuItems={
                !isLocked ? (
                  <ConvoMessageContextMenuItems
                    message={message}
                    contentsRef={contentsRef}
                    textContentRef={textContentRef}
                    onCopyImage={handleCopyImage}
                    items={getContextMenuItems(undefined)}
                  />
                ) : undefined
              }
            />
          </>
        )}
      </ChatBubble>
    );

    const renderChatBubblewithPopOver = () => (
      <PopOver
        triggerType="contextmenu"
        contentWrapperClassName="chatBubblePopoverWrapper"
        iconGutter
        popoverContent={(event) => {
          // Check if the right-click target is within the chat bubble
          if (!(event?.target as Element)?.closest('[data-anchor-chat-bubble]')) return null;

          const link = valueIfInstanceOf(event?.target, HTMLAnchorElement);

          // Only apply the link context menu to markdown links and ignore
          // other things that use <a> elements (e.g., Mentions)
          const isMarkdownLink = link?.dataset.markdown === 'link';
          const linkUrl = isMarkdownLink ? link?.href : undefined;

          return !isLocked ? (
            <ConvoMessageContextMenuItems
              message={message}
              contentsRef={contentsRef}
              textContentRef={textContentRef}
              onCopyImage={handleCopyImage}
              linkUrl={linkUrl}
              items={getContextMenuItems(linkUrl)}
            />
          ) : (
            <></>
          );
        }}
      >
        {chatBubble}
      </PopOver>
    );

    const enableContextMenu = isInteractive && !contentDisabled;

    return (
      <>
        <ChatBubbleContainer
          id={chatBubbleContainerDOMId(id)}
          variant={variant}
          senderName={senderName ?? ''}
          senderId={message.senderHash}
          key={message.msgId}
          showSenderName={showSenderName}
          showAvatar={showAvatar}
          verified={
            sender?.verificationStatus === ContactBackup.Contact.VerificationStatus.VERIFIED
          }
          stretchToFit={!messagesRightSide}
          isBot={!!sender?.isBot}
          isSharingLocation={!!sender?.isLocationSharing}
          isGuest={!!sender?.isGuest}
        >
          {enableContextMenu ? renderChatBubblewithPopOver() : chatBubble}
        </ChatBubbleContainer>
      </>
    );
  }
);

if (__DEV__) BaseConvoMessage.displayName = 'BaseConvoMessage';
