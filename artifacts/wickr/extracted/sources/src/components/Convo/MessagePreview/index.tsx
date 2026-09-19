import { ContactBackup } from '@amzn/wickr-messaging-protocol-proto';
import { clsx } from 'clsx';
import { secondsToMilliseconds } from 'date-fns';
import React, { forwardRef, RefObject } from 'react';
import ConvoMessageAudioContent from '../ConvoMessageAudioContent';
import ConvoMessageImageContent from '../ConvoMessageImageContent';
import ConvoMessageLocationContent from '../ConvoMessageLocationContent';
import { useIsExpired } from '../ExpirationIntervalContext';
import {
  Button,
  LastLocationIcon,
  LiveLocationIcon,
  SpinnerIcon,
  VerifiedIcon,
} from '@/componentlibrary';
import { Avatar } from '@/components/Avatar';
import { MarkdownText } from '@/components/MarkdownText';
import useForwardedRef from '@/hooks/useForwardedRef';
import useLatestCallback from '@/hooks/useLatestCallback';
import { useAppTranslation } from '@/lib/i18n';
import {
  WickrMessage,
  WickrMessageType,
  isForwardedMessage,
  messageHasAudioMetadata,
} from '@/lib/protobuf/messages';
import { useAppDispatch, useAppSelector } from '@/store';
import { useSetting } from '@/store/hooks/useSetting';
import { useUser } from '@/store/hooks/useUsers';
import { selectSelfUserIdHash } from '@/store/slices/identity';
import { MessagePreviewType } from '@/store/slices/uiChat';
import { openModal } from '@/store/thunks/modals';
import { openLink } from '@/store/thunks/ui';
import { getGoogleMapsLocationUrl } from '@/utils/geoLocation';
import { getContactDisplayName } from '@/utils/strings';
import { getAttachmentPreview } from './attachmentUtils';

import styles from './styles.module.less';

interface MessagePreviewProps {
  type: MessagePreviewType;
  isLoading?: boolean;
  className?: string;
  onClick?: () => void;
  message?: WickrMessage;
  isInteractive?: boolean;
}

/** Message previews are used for quotes/replies/forwards and editing your own messages */
const MessagePreview = forwardRef<HTMLElement, MessagePreviewProps>(
  ({ type, isLoading, className, message, onClick, isInteractive }, ref) => {
    const { t } = useAppTranslation();
    const shareExpiration = message?.location?.shareExpiration;
    const isExpired = useIsExpired(shareExpiration ?? 0);
    const Tag = onClick ? Button : 'div';
    const dispatch = useAppDispatch();
    const isEnterprise = useSetting('isEnterprise');

    const senderIdHash = message?.senderHash;
    const messageSender = useUser(senderIdHash);
    const messageSenderName = getContactDisplayName(messageSender) || t('Unknown Account');
    const selfUserIdHash = useAppSelector(selectSelfUserIdHash);
    const shouldShowVerificationBadge =
      messageSender?.verificationStatus === ContactBackup.Contact.VerificationStatus.VERIFIED &&
      selfUserIdHash !== messageSender.idHash;
    const attachmentPreview = getAttachmentPreview(t, message);
    const forwardedRef = useForwardedRef(ref);

    const handleClickLocationContent = useLatestCallback(() => {
      if (!message || !isInteractive) return;

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
      if (isForwardedMessage(message) && message.location) {
        dispatch(
          openModal({
            name: 'LocationModal',
            params: {
              type: 'forwarded',
              message,
            },
          })
        );
      }
    });

    const renderContent = () => {
      if (type === 'reply' && isForwardedMessage(message)) {
        return <p className={styles.italics}>{t('Forwarded message')}</p>;
      }

      if (isLoading) {
        return (
          <span className={styles.spinnerIcon}>
            <SpinnerIcon width="1.25rem" />
          </span>
        );
      }

      if (attachmentPreview && message) {
        if (messageHasAudioMetadata(message) && isInteractive) {
          return <ConvoMessageAudioContent message={message} />;
        } else {
          return (
            <div className={styles.attachmentPreview}>
              {attachmentPreview.imgSrc && message ? (
                <ConvoMessageImageContent
                  message={message}
                  isInteractive={isInteractive}
                  ref={forwardedRef as RefObject<HTMLImageElement>}
                  isPreview
                />
              ) : (
                <>
                  {attachmentPreview.icon}
                  <div>
                    {attachmentPreview.name}
                    <div className={styles.fileData}>
                      <span>{attachmentPreview.size}</span>
                      <span>{attachmentPreview.type}</span>
                    </div>
                  </div>
                </>
              )}
            </div>
          );
        }
      }

      if (message?.type === WickrMessageType.MsgType_Location) {
        if (type === 'reply') {
          // Don't show the full map for a reply
          return renderLiveLocation();
        } else {
          // Forwarded messages should show the full map (and you can't edit location messages)
          return (
            <ConvoMessageLocationContent
              latitude={message.location?.latitude}
              longitude={message.location?.longitude}
              onClickLocation={handleClickLocationContent}
            />
          );
        }
      }

      return (
        <MarkdownText
          text={message?.textContent ?? t('Conversations.MessageExpired')}
          mentions={message?.text?.mentionList}
          isPreview
          ref={forwardedRef as RefObject<HTMLDivElement>}
        />
      );
    };

    const renderLiveLocation = () => {
      if (!shareExpiration) return <>{t('[location]')}</>;
      let liveLocation;

      if (shareExpiration === -1 || isExpired) {
        liveLocation = (
          <>
            <LastLocationIcon className={styles.lastLocationIcon} size="20" />
            {t('Message.Location.LastLocationSent')}
          </>
        );
      } else if (shareExpiration > 0) {
        liveLocation = (
          <>
            <LiveLocationIcon className={styles.liveLocationIcon} size="24" />
            {t('Message.Location.LiveUntil', {
              shareExpiration: secondsToMilliseconds(shareExpiration),
              formatParams: {
                shareExpiration: {
                  timeStyle: 'short',
                },
              },
            })}
          </>
        );
      }

      return <div className={styles.liveLocationStatus}>{liveLocation}</div>;
    };

    return (
      <Tag
        className={clsx(styles.previewContainer, className, {
          [styles.clickable]: onClick,
          [styles.reply]: type === 'reply',
          [styles.edit]: type === 'edit',
        })}
        onClick={onClick}
      >
        {type === 'reply' && <div className={styles.border} />}
        <div
          className={clsx(styles.contentWrapper, {
            [styles.outgoingForwardContainer]: type === 'outgoing-forward',
          })}
        >
          {
            // `message` may be missing for replies, but we still need to render everything else
            message &&
              !type.includes('forward') &&
              (type === 'edit' ? (
                <div className={styles.editTitle}>{t('Compose.EditMessage')}</div>
              ) : (
                <div className={styles.titleWrapper}>
                  {senderIdHash && (
                    <Avatar userIdHash={senderIdHash} size={28} name={messageSenderName} />
                  )}
                  <div className={styles.title}>{messageSenderName}</div>
                  {shouldShowVerificationBadge && <VerifiedIcon />}
                </div>
              ))
          }
          <blockquote
            className={clsx(styles.content, {
              [styles.replyContent]: type === 'reply',
              [styles.outgoingForwardContent]: type === 'outgoing-forward',
              [styles.isAttachment]:
                !!attachmentPreview || message?.type === WickrMessageType.MsgType_Location,
            })}
          >
            {renderContent()}
          </blockquote>
          {type === 'incoming-forward' && message && (
            <span className={styles.forwardedMessageMetadata}>{t('Forwarded message')}</span>
          )}
        </div>
      </Tag>
    );
  }
);

const MemoComponent = React.memo(MessagePreview);
if (__DEV__) MemoComponent.displayName = 'MessagePreview';

export { MemoComponent as MessagePreview };
