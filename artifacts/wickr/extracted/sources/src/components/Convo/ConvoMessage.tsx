import React, { HTMLProps, useEffect } from 'react';
import { Logger } from '@/lib/logger';
import { WickrConvoType } from '@/lib/protobuf/convos';
import { useAppDispatch, useAppSelector, useAppSelectorExtra } from '@/store';
import { useSetting } from '@/store/hooks/useSetting';
import { selectConvoType } from '@/store/slices/convos';
import { clearHighlightedMsgId, selectHighlightedMsgId } from '@/store/slices/uiChat';
import { BaseConvoMessage } from './BaseConvoMessage';
import {
  useCurrentMessage,
  useCurrentMessageSharedState,
} from './ConvoMessage/CurrentMessageContext';
import MessageIntersectionObserver from './ConvoMessagesObservers/intersectionObserver/MessageIntersectionObserver';
import MessageButtonSet from './MessageButtonSet';

// Used for clearing highlighted message in redux
// Must be equal to the duration of .highlight in Convo.module.less
// keep this short as it will not clear highlight when switching convos
const HIGHLIGHT_ANIMATION_DURATION_MS = 1500;

const logger = new Logger('ConvoMessage');

export type MessageVariant = 'incoming' | 'outgoing';

interface ConvoMessageProps extends HTMLProps<HTMLElement> {
  id: string;
  showSenderName?: boolean;
  showAvatar?: boolean;
  isTableMessage?: boolean;
  isLastMessage?: boolean;
}

export const chatBubbleContainerId = (msgId: string) => `chat-bubble-container-${msgId}`;
export const chatBubbleId = (msgId: string) => `chat-bubble-${msgId}`;

const ConvoMessage: React.FC<ConvoMessageProps> = ({
  id,
  showSenderName,
  showAvatar,
  isTableMessage,
  isLastMessage,
}) => {
  const dispatch = useAppDispatch();
  const message = useCurrentMessage();
  const variant = message.outbox ? 'outgoing' : 'incoming';
  const convoId = message.vGroupID;
  const convoType = useAppSelectorExtra(selectConvoType, message.vGroupID);
  const autoUnlockEnabled = useSetting('isAutoUnlockMessages');
  const botButtonsEnabledInRoom = useSetting('enableBotButtonsInRooms');
  const botButtonsEnabled = convoType === WickrConvoType.DM ? true : botButtonsEnabledInRoom;
  const showMessageButtonSet = message.text?.buttons?.button && isLastMessage && botButtonsEnabled;
  /**
   * Locked messages are hidden and must be clicked to "unlock", showing the contents
   * and potentially starting a burn on read timer if it exists.
   *
   * Conditions
   *  - Auto unlocking messages setting must be disabled
   *  - Message must not be read already
   *  - Message must be incoming (outgoing messages are automatically unlocked)
   */
  const messageIsLocked = !autoUnlockEnabled && !message.isRead && variant === 'incoming';

  const isHighlighted = useAppSelector(selectHighlightedMsgId) === message.msgId;

  useEffect(() => {
    if (isHighlighted) {
      const handle = setTimeout(() => {
        dispatch(clearHighlightedMsgId(message.msgId));
      }, HIGHLIGHT_ANIMATION_DURATION_MS);
      return () => {
        clearTimeout(handle);
      };
    }
  }, [isHighlighted, message.msgId, dispatch]);

  const [{ reactionsLoading }] = useCurrentMessageSharedState();

  return (
    <MessageIntersectionObserver message={message} messageIsLocked={messageIsLocked}>
      <BaseConvoMessage
        id={id}
        showSenderName={showSenderName}
        showAvatar={showAvatar}
        isTableMessage={isTableMessage}
        isLastMessage={isLastMessage}
        isInteractive={true}
        message={message}
        convoType={convoType}
        isHighlighted={isHighlighted}
        reactionsLoading={reactionsLoading}
        isLocked={messageIsLocked}
      />
      {showMessageButtonSet && (
        <MessageButtonSet buttons={message.text?.buttons?.button ?? undefined} convoId={convoId} />
      )}
    </MessageIntersectionObserver>
  );
};

export default ConvoMessage;
