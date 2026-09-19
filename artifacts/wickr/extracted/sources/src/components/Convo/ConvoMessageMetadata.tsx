import { clsx } from 'clsx';
import { isToday, isYesterday } from 'date-fns';
import { forwardRef, useMemo, useState } from 'react';
import {
  Button,
  CautionIcon,
  CheckCircleFilledIcon,
  CheckIcon,
  IconButton,
  MoreIcon,
  PopOver,
  ReturnIcon,
  ScreenReaderContent,
  SpinnerIcon,
  Tooltip,
} from '@/componentlibrary';
import { AppTranslationKey, useAppTranslation } from '@/lib/i18n';
import { Logger } from '@/lib/logger';
import { WickrMessage, WickrOutboxStatus, isCallMessage } from '@/lib/protobuf/messages';
import { useAppDispatch, useAppSelector } from '@/store';
import { useSetting } from '@/store/hooks/useSetting';
import { selectActiveConvoHasUnauthorizedMembers } from '@/store/slices/convos/convosSelectors';
import { selectSelfUserIdHash } from '@/store/slices/identity';
import { setActiveReplyOrEditMsg } from '@/store/slices/uiChat';
import { emojiReact, resendMessage } from '@/store/thunks/messages';
import { showMessageInfo } from '@/store/thunks/ui';
import { RelativeTime, getHourCycle } from '@/utils/date';
import {
  addReactionLoading,
  removeReactionLoading,
  useCurrentMessageSharedState,
} from './ConvoMessage/CurrentMessageContext';
import EmojiPopper from './EmojiPicker/EmojiPopper';
import { ExpirationTime } from './ExpirationTime';

import styles from './Convo.module.less';

const logger = new Logger('ConvoMessageMetadata');

export type ConvoMetadataProps = {
  message: WickrMessage;
  showMetadata: boolean;
  /* This prop is mainly to distinguish between the chat bubble in the message list and the message info panel
   * - If in message list, isInteractive = true
   * - If in message info panel, isInteractive = false
   */
  isInteractive?: boolean;
  menuItems?: ReactJSXChild;
  isLocked?: boolean;
};

const ConvoMessageMetadata = forwardRef<HTMLDivElement, ConvoMetadataProps>(
  ({ message, showMetadata, isInteractive, menuItems, isLocked }, ref) => {
    const dispatch = useAppDispatch();
    const [{ reactionsLoading }, messageDispatch] = useCurrentMessageSharedState();
    const [timestampLabel, setTimestampLabel] = useState('');
    const myId = useAppSelector(selectSelfUserIdHash);
    const use12HourFormat = useSetting('use12HourFormat');
    const hourCycle = getHourCycle(use12HourFormat);
    const { t } = useAppTranslation();
    const hasUnauthorizedMembers = useAppSelector(selectActiveConvoHasUnauthorizedMembers);

    const {
      isDelayed,
      msgId,
      vGroupID,
      timeStamp,
      starred,
      outboxStatus,
      outbox,
      uploadErrors,
      rrReceived,
      destructTime,
      editTimestamp,
    } = message;
    const isEdited = !!editTimestamp;
    const failedToSendTooltip = useMemo(() => {
      if (isToday(timeStamp)) {
        return t('Message failed to send. Last attempt at {{time, dateTime}} Today.', {
          time: timeStamp,
          formatParams: {
            time: {
              hour: 'numeric',
              minute: '2-digit',
              hourCycle: hourCycle,
            },
          },
        });
      } else if (isYesterday(timeStamp)) {
        return t('Message failed to send. Last attempt at {{time, dateTime}} Yesterday.', {
          time: timeStamp,
          formatParams: {
            time: {
              hour: 'numeric',
              minute: '2-digit',
              hourCycle: hourCycle,
            },
          },
        });
      }

      return t(
        'Message failed to send. Last attempt at {{time, dateTime}} on {{date, dateTime}}.',
        {
          time: timeStamp,
          date: timeStamp,
          formatParams: {
            time: {
              hour: 'numeric',
              minute: '2-digit',
              hourCycle: hourCycle,
            },
            date: {
              year: '2-digit',
              month: 'numeric',
              day: 'numeric',
            },
          },
        }
      );
    }, [isToday(timeStamp), isYesterday(timeStamp)]);
    const editedAndDelayedText: JSX.Element | null = useMemo(() => {
      if (isInteractive) {
        if (isEdited && isDelayed) {
          return <span>{t('Edited, Delayed')}</span>;
        } else {
          return (
            <>
              {isEdited && <span>{t('Message.Edited')}</span>}
              {isDelayed && <span className={styles.delayed}>{t('Delayed')}</span>}
            </>
          );
        }
      } else {
        return isDelayed ? <span className={styles.delayed}>{t('Delayed')}</span> : null;
      }
    }, [isEdited, isDelayed, isInteractive]);

    const onExpirationTimeChanged = (time: RelativeTime) => {
      const tooltipKey = isDelayed
        ? 'Message sent delayed at {{timestamp, dateTime}} and will expire {{expireIn, relativetime}}'
        : 'Message.ExpirationTooltip';
      setTimestampLabel(
        t(tooltipKey, {
          timestamp: timeStamp,
          expireIn: time.amount,
          formatParams: {
            expireIn: { range: time.unit },
            timestamp: {
              hour: 'numeric',
              minute: '2-digit',
              second: '2-digit',
              hourCycle: hourCycle,
            },
          },
        })
      );
    };

    const handleEmojiReaction = async (emoji: string) => {
      if (hasUnauthorizedMembers) return false;

      return await dispatch(
        emojiReact({
          emoji,
          messageId: msgId,
          vgroupId: vGroupID,
        })
      ).unwrap();
    };

    let sendStatus = outboxStatus;
    let tMsgError: AppTranslationKey = isInteractive
      ? 'Message.Outbox.Failed'
      : 'Message failed to send';

    const containerClassName = clsx(styles.metadata, 'notSelectable', {
      [styles.isLocked]: isLocked,
    });

    const renderInteractiveItems = () => (
      <>
        {!isCallMessage(message) && !hasUnauthorizedMembers && (
          <Tooltip tip={t('Message.Menu.Reply')}>
            <IconButton
              label={t('Message.Menu.Reply')}
              onClick={() => {
                dispatch(
                  setActiveReplyOrEditMsg({
                    msgId,
                    type: 'reply',
                  })
                );
              }}
              className={styles.replyToButton}
              wrapperClassName={styles.replyToBtnWrapper}
            >
              <ReturnIcon width="18px" height="18px" />
            </IconButton>
          </Tooltip>
        )}
        {!isCallMessage(message) && !hasUnauthorizedMembers && (
          <EmojiPopper
            onEmojiSelection={async (emoji) => {
              if (emoji.native) {
                // disable skip emoji reaction on same emoji until loading resolves.
                if (reactionsLoading[emoji.native]) return;
                messageDispatch(
                  addReactionLoading({
                    reactionId: emoji.native,
                    selfUserId: myId,
                  })
                );
                if (!(await handleEmojiReaction(emoji.native))) {
                  messageDispatch(removeReactionLoading(emoji.native));
                }
              }
            }}
            offset={[0, 0]}
          />
        )}
        <PopOver popoverContent={menuItems} iconGutter>
          <Tooltip tip={t('Message.Menu.OpenMenu')}>
            <IconButton label={t('Message.Menu.OpenMenu')} wrapperClassName={styles.menuBtnWrapper}>
              <MoreIcon />
            </IconButton>
          </Tooltip>
        </PopOver>
      </>
    );

    // use the first uploadError with an error code (codes are numbers starting at 1)
    const uploadError = uploadErrors?.find((err) => err.errorCode);
    if (message.outbox) {
      // uploadError always comes with a message sent successfully
      if (uploadError) {
        sendStatus = WickrOutboxStatus.Outbox_Failed;
        if (isInteractive) {
          tMsgError = 'Tap for info';
        }
      }
    } else {
      // give non-outbox messages a sent status
      sendStatus = WickrOutboxStatus.Outbox_Sent;
    }

    switch (sendStatus) {
      // unsent (error sending, but can try again)
      case WickrOutboxStatus.Outbox_Unsent: {
        return isInteractive ? (
          <div ref={ref} className={containerClassName}>
            <Button
              className={styles.sendFailed}
              onClick={() => {
                dispatch(resendMessage({ vgroupId: vGroupID, messageId: msgId }));
              }}
            >
              {t('Message.Outbox.Retry')}
              <CautionIcon
                variant="error"
                width="1rem"
                height="1rem"
                filled
                className={styles.failureIcon}
              />
            </Button>
          </div>
        ) : (
          <div ref={ref} className={clsx(containerClassName, styles.sendFailed)}>
            {t(tMsgError)}
            <CautionIcon
              variant="error"
              width="1rem"
              height="1rem"
              filled
              className={styles.failureIcon}
            />
          </div>
        );
      }
      case WickrOutboxStatus.Outbox_Sending: {
        return (
          <div ref={ref} className={containerClassName}>
            <ScreenReaderContent>{t('Message.Outbox.Sending')}</ScreenReaderContent>
            <SpinnerIcon />
          </div>
        );
      }
      case WickrOutboxStatus.Outbox_Sent: {
        if (!showMetadata) return null;
        return (
          <div ref={ref} className={containerClassName}>
            {isInteractive && renderInteractiveItems()}
            <div className={styles.timestamp} data-testid="sent-timestamp">
              <ScreenReaderContent>{timestampLabel}</ScreenReaderContent>
              <div aria-hidden="true">
                {editedAndDelayedText}{' '}
                {t('Message.Timestamp', {
                  timestamp: timeStamp,
                  formatParams: {
                    timestamp: {
                      hour: 'numeric',
                      minute: '2-digit',
                      hourCycle: hourCycle,
                    },
                  },
                })}
                {isInteractive && (
                  <ExpirationTime
                    expiresAt={destructTime}
                    onExpirationTimeChanged={onExpirationTimeChanged}
                  />
                )}
              </div>
            </div>
            {rrReceived ? (
              <span className={styles.checkContainer}>
                <span aria-hidden="true">
                  {outbox && (
                    <CheckCircleFilledIcon className={styles.check} height="12px" width="12px" />
                  )}
                </span>
                <ScreenReaderContent>{t('Message.Read')}</ScreenReaderContent>
              </span>
            ) : (
              <span className={styles.checkContainer}>
                <span aria-hidden="true">
                  {outbox && <CheckIcon className={styles.check} height="12px" width="12px" />}
                </span>
                <ScreenReaderContent>{t('Message.Sent')}</ScreenReaderContent>
              </span>
            )}
          </div>
        );
      }
      case WickrOutboxStatus.Outbox_Failed: {
        return isInteractive ? (
          <div ref={ref} className={containerClassName} data-testid="send-failed">
            <Tooltip tip={failedToSendTooltip}>
              <Button
                color="secondaryRed"
                className={styles.sendFailed}
                onClick={() => {
                  dispatch(showMessageInfo(message));
                }}
              >
                {t(tMsgError)}
                <CautionIcon
                  variant="error"
                  width="1rem"
                  height="1rem"
                  filled
                  className={styles.failureIcon}
                />
              </Button>
            </Tooltip>
          </div>
        ) : (
          <div ref={ref} className={clsx(containerClassName, styles.sendFailed)}>
            {t(tMsgError)}
            <CautionIcon
              variant="error"
              width="1rem"
              height="1rem"
              filled
              className={styles.failureIcon}
            />
          </div>
        );
      }
      default: {
        logger.warn('Unknown message metadata rendering', { msgId, outbox, outboxStatus });
        return null;
      }
    }
  }
);

export default ConvoMessageMetadata;
