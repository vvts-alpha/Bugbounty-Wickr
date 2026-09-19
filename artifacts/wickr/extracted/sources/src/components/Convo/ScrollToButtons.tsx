import { clsx } from 'clsx';
import { FC, SyntheticEvent } from 'react';

import { KeyboardShortcut } from '../KeyboardShortcut';
import { Badge, CaretIcon, IconButton, InformationIcon, MentionIcon } from '@/componentlibrary';
import { useAppTranslation } from '@/lib/i18n';
import { HUNDRED_AND_MORE_BADGE_TEXT } from '@/utils/strings';
import { ScrollEventType } from './ConvoMessagesContainer';

import styles from './Convo.module.less';

interface Props {
  onClick: (button: ScrollEventType) => void;
  onWheel: (event: SyntheticEvent<HTMLElement, WheelEvent>) => void;
  unreadCount: number;
  mentionCount: number;
  isScrolledToBottom: boolean;
  errorCount: number;
}

export const ScrollToButtons: FC<Props> = ({
  onClick,
  onWheel,
  unreadCount,
  mentionCount,
  isScrolledToBottom,
  errorCount,
}) => {
  const { t } = useAppTranslation();

  return (
    <div className={styles.scrollToButtonsWrapper} onWheel={onWheel}>
      {errorCount > 0 && (
        <IconButton
          label={t('Conversations.ScrollToError')}
          className={styles.scrollToErrorButton}
          onClick={() => onClick('ScrollToError')}
          badge={
            errorCount && (
              <Badge value={errorCount < 100 ? errorCount : HUNDRED_AND_MORE_BADGE_TEXT} />
            )
          }
          badgeWrapperClassName={styles.scrollToErrorButtonBadge}
        >
          <InformationIcon size="24px" />
        </IconButton>
      )}
      {mentionCount > 0 && (
        <IconButton
          label={t('Conversations.ScrollToMention')}
          className={styles.scrollToMentionButton}
          onClick={() => onClick('ScrollToMention')}
          badge={
            mentionCount && (
              <Badge value={mentionCount < 100 ? mentionCount : HUNDRED_AND_MORE_BADGE_TEXT} />
            )
          }
          badgeWrapperClassName={styles.scrollToMentionButtonBadge}
        >
          <MentionIcon size="24px" />
        </IconButton>
      )}
      {!isScrolledToBottom && (
        <>
          <KeyboardShortcut
            shortcut="ScrollToBottom"
            onShortcut={() => onClick('ScrollToBottom')}
          />
          <IconButton
            label={t('Conversations.ScrollToBottom')}
            className={clsx(styles.scrollToBottomButton, unreadCount > 0 ? styles.active : '')}
            onClick={() => onClick('ScrollToBottom')}
            badge={
              unreadCount && (
                <Badge value={unreadCount < 100 ? unreadCount : HUNDRED_AND_MORE_BADGE_TEXT} />
              )
            }
            badgeWrapperClassName={styles.scrollToBottomButtonBadge}
          >
            <CaretIcon direction="down" size="24px" />
          </IconButton>
        </>
      )}
    </div>
  );
};

export default ScrollToButtons;
