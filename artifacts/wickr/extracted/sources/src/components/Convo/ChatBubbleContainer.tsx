import { clsx } from 'clsx';
import React, { HTMLAttributes, ReactNode, Ref, useMemo } from 'react';

import { PresenceIcon } from '../../componentlibrary';
import Tooltip from '../../componentlibrary/Tooltip';
import { BotIcon, LocationIcon, VerifiedIcon } from '../../componentlibrary/icons';
import { Avatar } from '@/components/Avatar';
import { useAppTranslation } from '@/lib/i18n';
import { useAppDispatch, useAppSelector } from '@/store';
import { useConvoMember } from '@/store/hooks/useConvoMembers';
import { selectActiveConvoId } from '@/store/slices/shared';
import { viewContactDetails } from '@/store/thunks/ui';
import { getPresenceLabel, shouldShowPresenceIcon } from '@/utils/presence';

import styles from '@/componentlibrary/Chat/ChatBubble/ChatBubble.module.less';

export type Message = {
  /** The displayed text of the message sent. */
  content: string;
  /** The timestamp when the message was originally sent by the sender. */
  createdTimestamp: string;
  /** The timestamp of the last time the message was edited. */
  lastEditedTimestamp?: string;
  /** Determines if a message was redacted (deleted) by a user. */
  redacted: boolean;
  /** The display name of the sender. */
  senderName: string;
  /** The unique identifier of the sender. */
  senderId: string;
};

export type MessageVariant = 'outgoing' | 'incoming';

export interface ChatBubbleContainerProps extends HTMLAttributes<HTMLDivElement> {
  /** Name of message sender */
  senderName: string;
  /** userId of message sender */
  senderId: string;
  /** The time the message was originally sent. */
  timestamp?: string | ReactNode;
  /** The label used for availability. */
  a11yLabel?: string;
  /** Determines styling for outgoing and incoming messages. */
  variant: MessageVariant;
  /** Determines rendering of sender name */
  showSenderName?: boolean;
  /** Determines rendering of avatar */
  showAvatar?: boolean;
  /** Whether or not the sender has been verified. */
  verified?: boolean;
  /** If the stretch to fit setting for messages is enabled */
  stretchToFit?: boolean;
  /** Whether or not the sender is a bot. */
  isBot?: boolean;
  /** Flag to show that live sharing is enabled next to sender name */
  isSharingLocation?: boolean;
  /** Whether or not the sender is a guest. */
  isGuest?: boolean;
}

// This is used to select the highest level container for the chat bubble.
// Useful for markdown and message utils when needing access to high level components.
export const CHAT_BUBBLE_CONTAINER_GLOBAL_CLASSNAME = 'chatBubbleContainer';

export const ChatBubbleContainer = React.forwardRef<HTMLDivElement, ChatBubbleContainerProps>(
  (props, ref: Ref<HTMLDivElement>) => {
    const { t } = useAppTranslation();
    const {
      id,
      timestamp,
      a11yLabel = 'Open channel options',
      senderName,
      senderId,
      variant,
      showSenderName = true,
      showAvatar = true,
      verified = false,
      stretchToFit = false,
      isBot = false,
      isSharingLocation,
      isGuest = false,
      ...rest
    } = props;
    const dispatch = useAppDispatch();
    const activeConvoId = useAppSelector(selectActiveConvoId);
    const member = useConvoMember(activeConvoId, senderId);
    const timeIdle = member?.timeIdle ?? -1;

    const senderNameWithLabel = isGuest
      ? `${senderName} ${t('Conversations.Guest')}`
      : `${senderName}`;

    const handleAvatarClick = () => {
      if (member?.id) {
        dispatch(
          viewContactDetails({
            userId: member?.id,
            userIdHash: member?.idHash,
          })
        );
      }
    };

    const presenceTooltip = useMemo(() => getPresenceLabel(timeIdle, t), [timeIdle]);

    let accessibleLabel = senderNameWithLabel;
    if (shouldShowPresenceIcon(timeIdle))
      accessibleLabel = accessibleLabel + ', ' + getPresenceLabel(timeIdle, t);
    if (variant === 'incoming' && verified) {
      accessibleLabel = accessibleLabel + ', ' + t('Conversations.Verified');
    }
    if (isBot) {
      accessibleLabel = accessibleLabel + ', ' + t('Bot');
    }

    return (
      <div
        className={clsx(CHAT_BUBBLE_CONTAINER_GLOBAL_CLASSNAME, styles.chatBubbleContainer, {
          [styles.incomingContainer]: variant === 'incoming',
          [styles.outgoingContainer]: variant === 'outgoing',
          [styles.isConsecutiveMessage]: !showSenderName && !showAvatar,
          [styles.stretchToFit]: stretchToFit,
        })}
        data-testid="chat-bubble-container"
        ref={ref}
        {...rest}
      >
        {/*
         * When using scrollIntoView, we want to scroll the _top_ of the message into the _center_ of the container,
         * so we need a point of reference that does not contain the message contents.
         */}
        <div id={id} />
        {showSenderName && (
          <>
            <div className={clsx(styles.senderName)}>
              <span
                aria-label={accessibleLabel}
                className={clsx(styles.displayedSenderName, 'notCopyable')}
              >
                {/* Add a placeholder for sender name when it's empty (to reduce scroll position shift) */}
                {!senderName ? <>&nbsp;</> : senderNameWithLabel}
              </span>
              {shouldShowPresenceIcon(timeIdle) && (
                <Tooltip tip={presenceTooltip}>
                  <div aria-hidden="true">
                    <PresenceIcon timeIdle={timeIdle} />
                  </div>
                </Tooltip>
              )}
              {variant === 'incoming' && verified && (
                <Tooltip tip={t('Conversations.Verified')}>
                  <div className={styles.verified} aria-hidden={true}>
                    <VerifiedIcon />
                  </div>
                </Tooltip>
              )}
              {isBot && (
                <Tooltip tip={t('Bot')}>
                  <div className={styles.bot} aria-hidden="true">
                    <BotIcon filled />
                  </div>
                </Tooltip>
              )}
              {isSharingLocation && (
                <Tooltip tip={t('Message.Status.LocationSharing')}>
                  <div className={styles.locationSharingIcon}>
                    <LocationIcon filled size="1em" />
                  </div>
                </Tooltip>
              )}
            </div>
          </>
        )}
        <div className={styles.content}>
          {showAvatar && (
            <div className={clsx(styles.chatBubbleAvatar, 'notCopyable')} aria-hidden>
              <Avatar
                userIdHash={member?.idHash}
                name={senderName}
                onClick={variant === 'incoming' ? handleAvatarClick : undefined}
              />
            </div>
          )}
          {props.children}
        </div>
      </div>
    );
  }
);

if (__DEV__) ChatBubbleContainer.displayName = 'ChatBubbleContainer';

export default ChatBubbleContainer;
