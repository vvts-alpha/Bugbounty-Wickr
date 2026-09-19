import { MessageBody } from '@amzn/wickr-messaging-protocol-proto';
import { clsx } from 'clsx';
import { FC } from 'react';
import { Button, PhoneIcon } from '@/componentlibrary';
import { useAppTranslation } from '@/lib/i18n';
import { WickrConvoType } from '@/lib/protobuf/convos';
import { WickrCallStatus } from '@/lib/protobuf/messages';
import { useAppDispatch, useAppSelector } from '@/store';
import { selectSelfCallStatus } from '@/store/slices/calls';
import { selectActiveConvoMembers, selectActiveConvoType } from '@/store/slices/convos';
import { joinCall } from '@/store/thunks/convos';
import { toDurationString } from '@/utils/date';
import { getContactDisplayName } from '@/utils/strings';
import { MessageVariant } from './ConvoMessage';

import styles from './ConvoCallMessage.module.less';

interface ConvoCallMessageProps {
  callMessage: MessageBody.ICallMessage | null;
  senderUserName: string;
  msgId: string;
  convoId: string;
  variant: MessageVariant;
}

export const ConvoCallMessage: FC<ConvoCallMessageProps> = ({
  callMessage,
  senderUserName,
  msgId,
  convoId,
  variant,
  ...props
}) => {
  const activeConvoMembers = useAppSelector(selectActiveConvoMembers);
  const activeConvoType = useAppSelector(selectActiveConvoType);
  const selfCallStatus = useAppSelector(selectSelfCallStatus);

  // Member related to the current call status (ex: who started the call, who missed the call, etc.)
  // we do the following below because senderUserName updates depending on the call status update, but senderName (based on senderhash) does not. (it remains as whoever initiated the call)
  const callActionMember = activeConvoMembers?.filter((member) => member.id === senderUserName);
  const callActionSenderName = getContactDisplayName(callActionMember?.[0]);

  const dispatch = useAppDispatch();
  const { t } = useAppTranslation();

  const getTitles = () => {
    let title: string | undefined;
    let subtitle: string | undefined;

    if (callMessage) {
      if (callMessage.startInfo) {
        // Call in progress
        if (activeConvoType === WickrConvoType.DM) {
          title =
            variant === 'incoming'
              ? t('Conversations.CallMessage.IncomingCall')
              : t('Conversations.CallMessage.OutgoingCall');
        } else {
          title = t('Conversations.CallMessage.InProgress');
        }
        subtitle = t('Conversations.CallMessage.StartedBy', { senderName: callActionSenderName });
      } else if (callMessage.summary) {
        // Call ended
        title = t('Conversations.CallMessage.Ended');
        subtitle = t('Conversations.CallMessage.EndedBy', { senderName: callActionSenderName });

        if (activeConvoType === WickrConvoType.DM) {
          if (callMessage.summary.callDuration) {
            title = t('Conversations.CallMessage.CallEnded');
          } else {
            if (callMessage.summary.status === WickrCallStatus.COMPLETED) {
              title = t('Conversations.CallMessage.CallCancelled');
            }
            if (callMessage.summary.status === WickrCallStatus.MISSED) {
              if (variant === 'outgoing') {
                title = t('Conversations.CallMessage.CallNotAnswered');
              } else {
                title = t('Conversations.CallMessage.MissedCall');
                subtitle = t('Conversations.CallMessage.MissedCallFrom', {
                  senderName: callActionSenderName,
                });
              }
            }
          }
        }
      }
    }

    return { title, subtitle };
  };

  const { title, subtitle } = getTitles();
  const duration = toDurationString(callMessage?.summary?.callDuration || 0);
  const showDuration = !!callMessage?.summary?.callDuration;

  const handleClickToJoin = () => {
    dispatch(
      joinCall({
        messageId: msgId,
        vgroupId: convoId,
      })
    );
  };

  const showClickToJoinLink = callMessage?.startInfo && !selfCallStatus;

  return (
    <div {...props} className={styles.convoCallMessage}>
      <div
        className={clsx(styles.phoneIconContainer, {
          [styles.ended]: callMessage?.summary,
        })}
      >
        <PhoneIcon filled />
      </div>
      <div>
        <div className={styles.title}>{title}</div>
        <div className={styles.subtitle}>{subtitle}</div>
        {showDuration && (
          <div className={styles.duration}>
            {t('Conversations.CallMessage.Duration', { duration })}
          </div>
        )}
        {showClickToJoinLink && (
          <Button color="secondaryBlue" onClick={handleClickToJoin} className={styles.clickToJoin}>
            {t('Conversations.CallMessage.ClickToJoin')}
          </Button>
        )}
      </div>
    </div>
  );
};

export default ConvoCallMessage;
