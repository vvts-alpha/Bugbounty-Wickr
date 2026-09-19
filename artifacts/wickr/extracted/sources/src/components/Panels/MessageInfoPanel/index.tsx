import { ConvoCollection } from '@amzn/wickr-messaging-protocol-proto';
import { clsx } from 'clsx';
import { secondsToMilliseconds } from 'date-fns';
import { FC, useMemo } from 'react';
import {
  CautionIcon,
  CheckCircleFilledIcon,
  CheckIcon,
  DeleteIcon,
  GridGlobeIcon,
  List,
  Panel,
  PanelBody,
  PanelHeader,
  RetryIcon,
  SpinnerIcon,
} from '@/componentlibrary';
import { PanelListItem } from '@/componentlibrary/Panel/PanelListItem';
import { Avatar } from '@/components/Avatar';
import MessageSeparator from '@/components/Convo/MessageSeparator';
import { AppTranslationKey, useAppTranslation } from '@/lib/i18n';
import { Logger } from '@/lib/logger';
import { WickrOutboxStatus, WickrSendErrorCode, WickrUploadError } from '@/lib/protobuf/messages';
import { WickrUser } from '@/lib/protobuf/users';
import { useAppDispatch, useAppSelector, useAppSelectorExtra } from '@/store';
import { useAbortableDispatch } from '@/store/hooks/useAbortableDispatch';
import { useSetting } from '@/store/hooks/useSetting';
import {
  selectActiveConvoExternalMembers,
  selectActiveConvoMembers,
  selectActiveConvoMembersByIdHashes,
  selectActiveConvoSelfMember,
  selectConvoType,
} from '@/store/slices/convos';
import { selectSelfUserIsGuest } from '@/store/slices/identity';
import {
  clearPanelStack,
  MessageInfoPanelArgs,
  PANEL_SIDES,
  PanelName,
  popPanel,
  selectIsActivePanel,
} from '@/store/slices/panels';
import { selectPanelMessage } from '@/store/slices/uiChat';
import { selectAllUsers } from '@/store/slices/users';
import { deleteMessage, reportError, resendMessage } from '@/store/thunks/messages';
import { openModal } from '@/store/thunks/modals';
import { viewContactDetails } from '@/store/thunks/ui';
import { formatRelativeDate, getHourCycle, microsecondsToMilliseconds } from '@/utils/date';
import { getContactDisplayId, getContactDisplayName } from '@/utils/strings';
import PanelMessage from './PanelMessage';

import styles from './MessageInfoPanel.module.less';

const logger = new Logger('MessageInfoPanel');

export const MessageInfoPanel: FC<MessageInfoPanelArgs> = ({ closeIcon }) => {
  const name: PanelName = 'MessageInfoPanel';
  const side = PANEL_SIDES[name];
  const { t } = useAppTranslation();
  const dispatch = useAppDispatch();
  const abortableDispatch = useAbortableDispatch();
  const message = useAppSelector(selectPanelMessage);
  const selfMember = useAppSelector(selectActiveConvoSelfMember);
  const isActive = useAppSelectorExtra(selectIsActivePanel, name);
  const handleOutsideClick = () => isActive && dispatch(clearPanelStack());
  const sendStatus = message?.outboxStatus;
  const selfUserIsGuest = useAppSelector(selectSelfUserIsGuest);
  const externalMembers = useAppSelector(selectActiveConvoExternalMembers);
  const use12HourFormat = useSetting('use12HourFormat');
  const hourCycle = getHourCycle(use12HourFormat);
  const allUsers = useAppSelector(selectAllUsers);
  const convoType = useAppSelectorExtra(selectConvoType, message?.vGroupID ?? '');
  const isDm = convoType === ConvoCollection.ConvoMeta.ConvoType.DM;
  const otherConvoMembers = useAppSelector(selectActiveConvoMembers).filter(
    (u) => u.id !== selfMember?.id
  );

  // Get send error info, if applicable. A message can have at most one send error.
  const sendError = message?.wickrError?.[0];

  // Get info of the upload errors and affected recipients, if applicable
  const uploadErrors = message?.uploadErrors ?? [];
  const errorFlags = useMemo(() => {
    let hasUploadError = false;
    let hasTdfUnauthorizedError = false;
    for (const err of uploadErrors) {
      if (err.errorCode) {
        hasUploadError = true;
        if (err.errorCode === WickrUploadError.TDF_USER_NOT_AUTHORIZED) {
          hasTdfUnauthorizedError = true;
          return { hasUploadError, hasTdfUnauthorizedError };
        }
      }
    }
    return { hasUploadError, hasTdfUnauthorizedError };
  }, [uploadErrors]);

  const { hasUploadError, hasTdfUnauthorizedError } = errorFlags;

  const uploadErrorUserIdHashes: string[] = [];
  if (hasUploadError) {
    uploadErrors.forEach((uploadError) => {
      const users = uploadError.users;
      users?.forEach((user) => {
        user.idHash && uploadErrorUserIdHashes.push(user.idHash);
      });
    });
  }
  const uploadErrorUserList = useAppSelectorExtra(
    selectActiveConvoMembersByIdHashes,
    uploadErrorUserIdHashes
  );
  const uploadErrorUserIdHashMap =
    uploadErrorUserList &&
    Object.fromEntries(
      uploadErrorUserList.map((uploadErrorUser) => [uploadErrorUser.idHash, uploadErrorUser])
    );

  // Get delayed and read info
  const isDelayed = message?.isDelayed;
  const isRead = message?.rrReceived;
  let SendStatusIcon = CheckIcon;
  let sendStatusTextKey: AppTranslationKey = 'Sent';
  if (isRead) {
    SendStatusIcon = CheckCircleFilledIcon;
    sendStatusTextKey = 'Read';
  } else if (isDelayed) {
    sendStatusTextKey = 'Send was delayed';
  }

  if (!message) {
    return null;
  }

  // Send timestamp in milliseconds
  const sendTimestamp = message?.timeStamp;
  const sendTimestampLabel = t('Message.Timestamp', {
    timestamp: sendTimestamp,
    formatParams: {
      timestamp: {
        hour: 'numeric',
        minute: '2-digit',
        hourCycle: hourCycle,
      },
    },
  });
  const sendDateLabel = sendTimestamp ? formatRelativeDate(sendTimestamp, t) : '';

  // Original send timestamp in microseconds
  const origSendTimestamp = microsecondsToMilliseconds(message?.origSendTimestamp);
  const origSendTimestampLabel = t('Message.Timestamp', {
    timestamp: origSendTimestamp,
    formatParams: {
      timestamp: {
        hour: 'numeric',
        minute: '2-digit',
        hourCycle: hourCycle,
      },
    },
  });
  const origSendDateLabel = origSendTimestamp ? formatRelativeDate(origSendTimestamp, t) : '';

  // Read receipt timestamp in seconds
  const rrTimestamp = secondsToMilliseconds(message?.rrTimestamp);
  const rrTimestampLabel = t('Message.Timestamp', {
    timestamp: rrTimestamp,
    formatParams: {
      timestamp: {
        hour: 'numeric',
        minute: '2-digit',
        hourCycle: hourCycle,
      },
    },
  });
  const rrDateLabel = rrTimestamp ? formatRelativeDate(rrTimestamp, t) : '';

  const handleReport = () => {
    if (message) {
      dispatch(reportError({ msgId: message.msgId, vgroupId: message.vGroupID }));
    }
  };

  const handleResend = () => {
    if (message) {
      dispatch(resendMessage({ vgroupId: message.vGroupID, messageId: message.msgId }));
      dispatch(popPanel());
    }
  };

  const handleDelete = async () => {
    if (message) {
      try {
        const body = message.outbox
          ? t("The message/file will be deleted from all participants' devices.")
          : t('The message/file will be deleted from only your devices.');
        const confirmed = await abortableDispatch(
          openModal({ name: 'ConfirmModal', params: { title: t('Are you sure?'), body } })
        );
        if (confirmed) {
          dispatch(
            deleteMessage({
              messageId: message.msgId,
              vgroupId: message.vGroupID,
            })
          );
        }
      } catch {
        // no-op
      }
      dispatch(popPanel());
    }
  };

  const handleAvatarClick = (userId?: string, userIdHash?: string) => {
    dispatch(
      viewContactDetails({
        userId,
        userIdHash,
      })
    );
  };

  const renderReceiverInfo = (userMember?: WickrUser) => {
    const userIdHash = userMember?.idHash ?? '';
    const userId = getContactDisplayId(userMember);
    const userName = getContactDisplayName(userMember);
    const isExternal = !!externalMembers.find((member) => member.id === userId);

    return (
      <div className={styles.recipientContainer}>
        <div className={styles.avatar}>
          <Avatar
            user={userMember}
            userIdHash={userIdHash}
            name={userName}
            aria-disabled={!userIdHash && !userMember?.id}
            onClick={() => handleAvatarClick(userMember?.id, userMember?.idHash)}
          />
          {isExternal && !selfUserIsGuest && (
            <GridGlobeIcon filled className={styles.externalGlobe} />
          )}
        </div>
        <div className={styles.recipientInfo}>
          <div className={styles.recipientName}>
            {userName}
            {userMember?.isGuest && <span> {t('(guest)')}</span>}
          </div>
          {userName !== userId && <div className={styles.recipientSubtitle}>{userId}</div>}
          {isExternal && !selfUserIsGuest && (
            <div className={styles.recipientSubtitle}>{t('External member')}</div>
          )}
        </div>
      </div>
    );
  };

  const renderSendInfoByType = (
    sendInfoType: AppTranslationKey,
    dateLabel: string,
    timestampLabel: string
  ) => (
    <div className={styles.sendInfo}>
      <div className={styles.sendStatus}>
        <span>{t(sendInfoType)}</span>
      </div>
      <div className={styles.timestamp}>
        <span>{dateLabel}</span>
        <span>{timestampLabel}</span>
      </div>
    </div>
  );

  const renderReadDelayedStatus = () => (
    <div>
      {isDelayed && (
        <>
          {renderSendInfoByType('Attempted send', origSendDateLabel, origSendTimestampLabel)}
          {renderSendInfoByType('Delayed send', sendDateLabel, sendTimestampLabel)}
        </>
      )}
      {isRead && renderSendInfoByType('Read', rrDateLabel, rrTimestampLabel)}
    </div>
  );

  const sendErrorsInfo: {
    [key: number]: { title: AppTranslationKey; description: AppTranslationKey };
  } = {
    [WickrSendErrorCode.MESSAGE_DELIVERY_FAILURE]: {
      title: "Couldn't Send Message",
      description: 'Try again and if the problem continues, send an error report.',
    },
    [WickrSendErrorCode.VALIDATION_ERROR]: {
      title: 'Send Failed to Members',
      description: 'Try again and if the problem continues, send an error report.',
    },
    [WickrSendErrorCode.AES_DECRYPTION_ERROR]: {
      title: 'Message Failed',
      description:
        'Your message could not be sent. If the problem continues, send an error report.',
    },
    [WickrSendErrorCode.INVALID_USER]: {
      title: 'Invalid User',
      description: 'Your Wickr account is not active',
    },
    [WickrSendErrorCode.SUSPENDED_APP]: {
      title: 'Invalid User',
      description: 'Your Wickr account is not active',
    },
    [WickrSendErrorCode.SUSPENDED_USER]: {
      title: 'Account Suspended',
      description: 'Your Wickr account is not active',
    },
    [WickrSendErrorCode.SIEM_RATE_LIMIT]: {
      title: 'Rate Limited',
      description: 'SIEM Rate Limit.',
    },
    [WickrSendErrorCode.SERVER_NETWORK_ERROR]: {
      title: 'Send Failed',
      description: 'Try again and if the problem continues, send an error report.',
    },
    [WickrSendErrorCode.MESSAGE_SERVER_UPLOAD_FAILURE]: {
      title: 'Send Failed',
      description: 'Try again and if the problem continues, send an error report.',
    },
    [WickrSendErrorCode.MESSAGE_COMPOSE_FAILURE]: {
      title: 'Compose Failure',
      description: 'Message compose failure, could not create message.',
    },
    [WickrSendErrorCode.MESSAGE_DUPLICATE_UPLOAD]: {
      title: 'Send Failed',
      description: 'Message upload failure, rejected by server as possible duplicate.',
    },
    [WickrSendErrorCode.MESSAGE_COMPLIANCE_MISSING]: {
      title: 'Compliance invalid or missing',
      description: 'Message upload failure, missing compliance information.',
    },
    [WickrSendErrorCode.ROOM_INVALID_PROPERTIES]: {
      title: 'Invalid room state operation',
      description: 'Room state error, invalid metadata/membership fields.',
    },
    [WickrSendErrorCode.ROOM_INVALID_GENERATION]: {
      title: 'Invalid room state operation',
      description: 'Room state error, invalid room generation, does not match server.',
    },
    [WickrSendErrorCode.ROOM_SENDER_NOT_MEMBER]: {
      title: 'Invalid room state operation',
      description: 'Room state error, sender is not member of room.',
    },
    [WickrSendErrorCode.ROOM_SENDER_NOT_MODERATOR]: {
      title: 'Invalid room state operation',
      description:
        'Room state error, sender attempting to execute room state operations, but not moderator.',
    },
    [WickrSendErrorCode.ROOM_NO_MODERATORS_LEFT]: {
      title: 'Invalid room state operation',
      description: 'Room state error, no moderators left in room, last moderator cannot leave.',
    },
    [WickrSendErrorCode.ROOM_NOT_FOUND]: {
      title: 'Invalid room state operation',
      description: 'Room state error, room not found.',
    },
    [WickrSendErrorCode.ISSUE_WITH_TDF_PROVIDER]: {
      title: 'Send Failed',
      description: "Message couldn't be sent due to a TDF provider issue.",
    },
  };

  const uploadErrorsInfo: {
    [key: number]: { title: AppTranslationKey; description: AppTranslationKey };
  } = {
    [WickrUploadError.USER_VALIDATION_ERROR]:
      selfMember && !selfMember.isGuest
        ? {
            title: 'Cannot Find Account(s)',
            description:
              "You don't have permission to communicate with these external members or their accounts don't exist. Contact your Wickr administrator for more information.",
          }
        : {
            title: 'Message failed to send',
            description:
              "These users don't have permission to communicate with guest members or their accounts don't exist.",
          },
    [WickrUploadError.USER_NO_ACTIVE_DEVICES]: {
      title: 'Device Error',
      description: 'The listed accounts have no registered devices.',
    },
    [WickrUploadError.USER_SUSPENDED]: {
      title: 'User Suspended',
      description: 'The listed accounts have been suspended.',
    },
    [WickrUploadError.USER_NOT_ACTIVE]: {
      title: 'Account Removed',
      description: 'The listed accounts have been removed.',
    },
    [WickrUploadError.NETWORK_FEDERATION_FAILED]: {
      title: 'Timeout Error',
      description: 'The listed accounts cannot be reached.',
    },
    [WickrUploadError.GUEST_FEDERATION_DISABLED]: {
      title: 'Message failed to send',
      description:
        'Access to Guest users is disabled for your Wickr Network. Contact your Wickr administrator for more information.',
    },
    [WickrUploadError.GUEST_BLOCKED]: {
      title: 'Message failed to send',
      description:
        'The guest user you are trying to contact has been blocked. Contact your Wickr administrator for more information.',
    },
    [WickrUploadError.GUEST_SENDER_ASSOCIATION_FAILED]: {
      title: 'Message failed to send',
      description: 'You must have an active communication with a Wickr network in last 90 days.',
    },
    [WickrUploadError.GUEST_RECEIVER_ASSOCIATED_FAILED]: {
      title: 'Message failed to send',
      description:
        'The guest user you are trying to contact does not have an active communication with any wickr network user in the last 90 days.',
    },
    [WickrUploadError.TDF_USER_NOT_AUTHORIZED]: {
      title: 'Message failed to send',
      description:
        "These users don't have the correct entitlements to communicate in this conversation.",
    },
  };

  const renderUploadErrors = () => {
    const uploadErrorList: JSX.Element[] = [];

    uploadErrors?.forEach((uploadError) => {
      const tMsgUploadErrorTitle =
        uploadError?.errorCode && uploadErrorsInfo[uploadError.errorCode]?.title
          ? uploadErrorsInfo[uploadError.errorCode].title
          : 'Message failed to send';
      let tMsgUploadErrorDescription =
        uploadError?.errorCode && uploadErrorsInfo[uploadError.errorCode]?.description
          ? uploadErrorsInfo[uploadError.errorCode].description
          : 'Unknown';

      const users = uploadError.users;
      const userList: JSX.Element[] = [];

      // Check if self-user is included in TDF unauthorized error
      const isTdfUnauthorizedError =
        uploadError?.errorCode === WickrUploadError.TDF_USER_NOT_AUTHORIZED;
      const includesSelfUser = users?.some((user) => user.idHash === selfMember?.idHash);

      if (isTdfUnauthorizedError && message.file) {
        tMsgUploadErrorDescription = includesSelfUser
          ? 'You do not have the correct entitlements to send this file to this conversation.'
          : "Some members in this conversation don't have the correct entitlements to receive this file.";
      } else if (isTdfUnauthorizedError && includesSelfUser) {
        tMsgUploadErrorDescription =
          "You don't have the correct entitlements to communicate in this conversation.";
      } else {
        // Build user list for other cases
        users?.forEach((user) => {
          if (user.idHash) {
            const userIdHash = user.idHash;
            const userMember =
              uploadErrorUserIdHashMap?.[userIdHash] ||
              allUsers.find((user) => user.idHash === userIdHash);
            if (userMember) userList.push(renderReceiverInfo(userMember));
            else
              logger.warn(
                `renderUploadErrors::userMember not defined for userIdHash - ${userIdHash}`
              );
          }
        });
      }

      uploadErrorList.push(
        <div className={clsx(styles.sendStatusRecipientContainer, styles.border)}>
          <div className={styles.sendStatusHeader}>
            <CautionIcon variant="info" size="24px" filled={true} className={styles.icon} />
            <h2>{t(tMsgUploadErrorTitle)}</h2>
          </div>
          <div className={styles.sendStatusDescription}>{t(tMsgUploadErrorDescription)}</div>
          {userList}
        </div>
      );
    });
    return uploadErrorList;
  };

  // Unlike the upload errors, there could be at most one send error for an outbox message.
  const renderSendError = () => {
    const tMsgSendErrorTitle =
      (sendError?.errCode && sendErrorsInfo[sendError.errCode]?.title) || 'Connection Error';
    const tMsgSendErrorDescription =
      (sendError?.errCode && sendErrorsInfo[sendError.errCode]?.description) ||
      'A network error has occurred, please try again.';

    return (
      <div className={styles.sendStatusRecipientContainer}>
        <div className={styles.sendStatusHeader}>
          <CautionIcon variant="info" size="24px" filled={true} className={styles.icon} />
          <h2>{t(tMsgSendErrorTitle)}</h2>
        </div>
        <div className={styles.sendStatusDescription}>{t(tMsgSendErrorDescription)}</div>
      </div>
    );
  };

  const renderMessageMetadata = () => {
    if (message) {
      switch (sendStatus) {
        case WickrOutboxStatus.Outbox_Sending: {
          return (
            <>
              <div className={styles.sendStatusRecipientContainer}>
                <div className={styles.sendStatusHeader}>
                  <SpinnerIcon className={styles.icon} size="24px" />
                  <h2>{t('Message.Outbox.Sending')}</h2>
                </div>
              </div>
            </>
          );
        }
        // An upload error always comes with a message that was sent successfully
        case WickrOutboxStatus.Outbox_Sent: {
          return hasUploadError ? (
            <>
              {renderUploadErrors()}
              <List className={styles.list}>
                <PanelListItem onClick={handleDelete} color="secondaryRed">
                  <div className={styles.sendFailureOptionContainer}>
                    <DeleteIcon size="24px" className={styles.icon} />
                    <span>{t('Message.Info.DeleteMessage')}</span>
                  </div>
                </PanelListItem>
              </List>
            </>
          ) : (
            <>
              <div className={styles.sendStatusRecipientContainer}>
                <div className={styles.sendStatusHeader}>
                  <SendStatusIcon className={styles.icon} size="24px" />
                  <h2>{t(sendStatusTextKey)}</h2>
                </div>
                {isDm && renderReceiverInfo(otherConvoMembers[0])}
              </div>

              {renderReadDelayedStatus()}
            </>
          );
        }
        case WickrOutboxStatus.Outbox_Unsent:
        case WickrOutboxStatus.Outbox_Unknown:
        case WickrOutboxStatus.Outbox_Failed: {
          return hasTdfUnauthorizedError ? (
            <>
              {renderUploadErrors()}
              <List className={styles.list}>
                <PanelListItem onClick={handleDelete} color="secondaryRed">
                  <div className={styles.sendFailureOptionContainer}>
                    <DeleteIcon size="24px" className={styles.icon} />
                    <span>{t('Message.Info.DeleteMessage')}</span>
                  </div>
                </PanelListItem>
              </List>
            </>
          ) : (
            <>
              {renderSendError()}
              <List className={styles.list}>
                <PanelListItem onClick={handleReport}>
                  <div className={styles.sendFailureOptionContainer}>
                    <CautionIcon size="24px" className={styles.icon} />
                    <span>{t('Message.Info.ReportError')}</span>
                  </div>
                </PanelListItem>
                <PanelListItem onClick={handleResend}>
                  <div className={styles.sendFailureOptionContainer}>
                    <RetryIcon size="24px" className={styles.icon} />
                    <span>{t('Retry')}</span>
                  </div>
                </PanelListItem>
                <PanelListItem onClick={handleDelete} color="secondaryRed">
                  <div className={styles.sendFailureOptionContainer}>
                    <DeleteIcon size="24px" className={styles.icon} />
                    <span>{t('Message.Info.DeleteMessage')}</span>
                  </div>
                </PanelListItem>
              </List>
            </>
          );
        }
      }
    }
  };

  return (
    <Panel
      onClose={() => dispatch(popPanel())}
      side={side}
      onOutsideClick={handleOutsideClick}
      closeIcon={closeIcon}
    >
      <PanelHeader title={t('Message Info')} closeLabel={t('Close')} />
      <PanelBody>
        <MessageSeparator showDateSeparator={true} dateLabel={sendDateLabel} />
        {message && <PanelMessage key={message.msgId} id={message.msgId} message={message} />}
        {renderMessageMetadata()}
      </PanelBody>
    </Panel>
  );
};
