import { clsx } from 'clsx';
import { HTMLAttributes, ReactNode, forwardRef } from 'react';
import Button from '../../Button';
import { LockIcon } from '../../icons';
import { MessageVariant } from '@/components/Convo/ChatBubbleContainer';
import { useAppTranslation } from '@/lib/i18n';

import styles from './ChatBubble.module.less';

export interface ChatBubbleProps extends HTMLAttributes<HTMLDivElement> {
  /** Determines styling for outgoing and incoming messages. */
  variant: MessageVariant;
  /** The name of the user that sent the message. */
  senderName?: string;
  /** Adds the bubble tail style to a message. */
  showTail?: boolean;
  /** If the message is currently locked and needs to be clicked to unlock. */
  locked?: boolean;
  /** Called when the user clicks on a message to unlock it, if it is unlocked. */
  onClickUnlock?: () => void;
  /** Includes other elements or components, such as a message attachment. */
  children?: ReactNode | ReactNode[];
}

export const ChatBubble = forwardRef<HTMLDivElement, ChatBubbleProps>(
  ({ variant, senderName, showTail, locked, children, className, onClickUnlock, ...rest }, ref) => {
    const { t } = useAppTranslation();

    return (
      <div
        {...rest}
        className={clsx(className, 'ChatMessage__selectableText', styles.chatBubble, {
          [styles.outgoing]: variant === 'outgoing',
          [styles.incoming]: variant === 'incoming',
          [styles.locked]: locked,
        })}
        data-testid="chat-bubble"
        ref={ref}
      >
        {locked && (
          <Button
            onClick={onClickUnlock}
            className={styles.unlockBtn}
            wrapperClassName={styles.lockedMessage}
          >
            <LockIcon size="1.5em" /> {t('Unlock')}
          </Button>
        )}
        {children}
      </div>
    );
  }
);

if (__DEV__) ChatBubble.displayName = 'ChatBubble';

export default ChatBubble;
