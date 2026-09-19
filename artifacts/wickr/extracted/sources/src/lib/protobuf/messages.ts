import {
  ILink,
  IMessageBody,
  MessageBody,
  MessageCollection,
} from '@amzn/wickr-messaging-protocol-proto';
import { secondsToMilliseconds } from 'date-fns';
import isEqual from 'lodash/isEqual';
import { Logger } from '../logger';
import { PaginatedMessagesPayload } from '@/apis/webFetch';
import { MessagesUpdateReason } from '@/store/slices/convos/messagesAdapter';
import { microsecondsToMilliseconds } from '@/utils/date';
import { assertRequiredKeysFactory, assertOneOfKeys, assertRequiredKeys } from './utils';

const logger = new Logger('protobuf/messages');

export const INVALID_MESSAGE_BODY_PREFIX = '###InvalidMessageBody';

export const WickrMessageType = MessageCollection.MessageMeta.MessageType;
export const WickrControlMessageSettingsIdentifier = MessageBody.Control.Settings.Identifier;
export const WickrOutboxStatus = MessageCollection.MessageMeta.OutboxStatus;
export const WickrCallStatus = MessageBody.CallMessage.CallStatus;
export const WickrUploadError = MessageBody.UploadError.ErrorCode;
export type WickrTableMeta = MessageBody.Text.ITableMeta;
export type WickrMessageMention = MessageBody.Text.IMentionMsg;
// TODO update type guards so that we don't have "null" in mentions
export type WickrMessageMentions = WickrMessageMention[] | null | undefined;
export type WickrMessageButton = MessageBody.Text.ButtonMsg.IButton;

export type GroupAndMsgId = {
  vGroupID: string;
  msgId: string;
};

export type GroupAndMsgAndTempMsgId = GroupAndMsgId & {
  tempMsgId?: string;
};

export enum SpecialMsgId {
  UNREAD = 1,
  OLDEST,
  NEWEST,
}

export type FetchMessagesPayload = {
  vGroupID: string;
  msgId: string | SpecialMsgId;
  before: number;
  after: number;
  reason: MessagesUpdateReason;
};

export type WickrMessageCollection = {
  messages: WickrMessage[];
  hasMoreBefore?: boolean;
  hasMoreAfter?: boolean;
};

export type WickrReaction = Pick<MessageBody.Reaction, 'identifier' | 'userIDs'>;

/** Validates that vGroupID and msgId are set and truthy */
export const hasGroupAndMsgId = (obj: any) =>
  Boolean(
    obj &&
      obj.vGroupID &&
      obj.msgId &&
      typeof obj.vGroupID === 'string' &&
      typeof obj.msgId === 'string'
  );

export type RequiredMessageMeta = OptionalExceptForRequiredNonNullable<
  MessageCollection.IMessageMeta,
  | 'type'
  | 'vGroupID'
  | 'senderHash'
  | 'isRead'
  | 'timeStamp'
  | 'starred'
  | 'destructTime'
  | 'ttl'
  | 'bor'
  | 'msgId'
  | 'outbox'
  | 'retryCount'
  | 'unacknowledgedSendError'
  | 'rrReceived'
  | 'rrTimestamp'
  | 'msgTranslation'
  | 'origSendTimestamp'
  | 'isDelayed'
  | 'wickrError'
>;

export enum WickrSendErrorCode {
  MESSAGE_DELIVERY_FAILURE = 2002,
  VALIDATION_ERROR = 9,
  AES_DECRYPTION_ERROR = 17,
  INVALID_USER = 2,
  SUSPENDED_APP = 4,
  SUSPENDED_USER = 3,
  SIEM_RATE_LIMIT = 18,
  ISSUE_WITH_TDF_PROVIDER = 81,
  SERVER_NETWORK_ERROR = 2001,
  MESSAGE_SERVER_UPLOAD_FAILURE = 2003,
  MESSAGE_COMPOSE_FAILURE = 2000,
  MESSAGE_DUPLICATE_UPLOAD = 2004,
  MESSAGE_COMPLIANCE_MISSING = 2005,
  ROOM_INVALID_PROPERTIES = 2012,
  ROOM_INVALID_GENERATION = 2013,
  ROOM_SENDER_NOT_MEMBER = 2014,
  ROOM_SENDER_NOT_MODERATOR = 2015,
  ROOM_NO_MODERATORS_LEFT = 2016,
  ROOM_NOT_FOUND = 2017,
}

export enum WickrSourceDevice {
  IOS = 0,
  ANDROID = 1,
  MACOS = 2,
  LINUX = 3,
  WINDOWS = 4,
}

export type WickrMessageMeta = OmitNullableKeys<RequiredMessageMeta> &
  Pick<MessageCollection.IMessageMeta, 'outboxStatus'>;

export type WickrMessageLocation = OptionalExceptFor<
  MessageBody.Location,
  'longitude' | 'latitude'
>;

/*
oneof content {
    Text text = 2;
    KeyVerify keyVerify = 3;
    Control control = 4;
    File file = 5;
    CallMessage callmessage = 6;
    Location location = 9;
    Edit edit = 10;
    DecryptionError decryptionError = 14;
    ReactionMessage reactionMessage = 17;
    EditContent editContent = 19;
}
*/

export type RequiredMessageBody = OptionalExceptForRequiredNonNullable<
  IMessageBody,
  'senderUserName'
>;

export type WickrMessageBody = Omit<RequiredMessageBody, 'reactions'> & {
  reactions: WickrReaction[];
};

export type WickrMessage = WickrMessageMeta &
  WickrMessageBody & {
    textContent: string;
    imgSrc?: string;
    timeStampMicroseconds: number;
    /** Determines whether there is a pending translation request for the message */
    msgTranslationPending: boolean;
    /** Determines whether this is an auto-generated summary message */
    isAutoSummaryMessage?: boolean;
  };

export type WickrForwardMessage = WickrMessage & {
  forwardMessage: RequiredNonNullable<MessageBody.ForwardMessage>;
};

export type WickrMessageLink = ILink;

export const assertRequiredMessageMeta = assertRequiredKeysFactory<RequiredMessageMeta>([
  'type',
  'vGroupID',
  'senderHash',
  'isRead',
  'timeStamp',
  'starred',
  'destructTime',
  'ttl',
  'bor',
  'msgId',
  'outbox',
]);

export const assertRequiredForwardMessage = assertRequiredKeysFactory<MessageBody.ForwardMessage>([
  'senderUserName',
  'sentTimestamp',
  'msgID',
  'vGroupID',
  'senderUserIDHash',
]);

export const assertRequiredMessageBody = (body: IMessageBody | any): WickrMessageBody =>
  (assertRequiredKeys<RequiredMessageBody>(body, ['senderUserName']) &&
    assertOneOfKeys<IMessageBody>(body, [
      'text',
      'keyVerify',
      'control',
      'file',
      'callmessage',
      'location',
      'edit',
      'decryptionError',
      'reactionMessage',
      'editContent',
    ])) as WickrMessageBody;

export function messageItemToWickrMessage(
  item?: MessageCollection.IMessageItem
): WickrMessage | undefined {
  if (!item) {
    return undefined;
  }
  const msg = MessageCollection.MessageItem.toObject(item as MessageCollection.MessageItem);

  const { msgMeta, msgBody } = msg;

  // Optional fields create TS errors inside the isRequired block below, so pull them out early.
  const outboxStatus = msgMeta?.outboxStatus;

  let meta: RequiredMessageMeta | undefined;
  let body: RequiredMessageBody | undefined;

  try {
    meta = assertRequiredMessageMeta(msgMeta);
  } catch {
    // no way to recover, do nothing
  }

  try {
    body = assertRequiredMessageBody(msgBody);
  } catch (err) {
    const type = meta?.type;
    // overwrite the type so that the error message displays
    if (meta) {
      meta.type = WickrMessageType.MsgType_Text;
    }

    let text = `${INVALID_MESSAGE_BODY_PREFIX}: message type ${type}:
${err}`;

    if (__DEV__) {
      text += `
\`\`\`
${JSON.stringify(msgBody, undefined, 2)}
\`\`\`
`;
    }
    text += ` (Error hidden in production)`;

    // insert an error message body for now, so we can at least get a handle on things
    body = {
      senderUserName: '',
      text: {
        markdownVersion: 2,
        text,
      },
      keyVerify: null,
      control: null,
      file: null,
      callmessage: null,
      location: null,
      edit: null,
      decryptionError: null,
      reactionMessage: null,
      editContent: null,
      targetUsers: [],
      targetUsersv2: [],
      editTimestamp: null,
      inReplyTo: null,
      uploadErrors: [],
      reactions: [],
      isContentEdited: null,
    };
  }

  if (meta && body) {
    const {
      type,
      vGroupID,
      senderHash,
      isRead,
      timeStamp,
      starred,
      destructTime,
      ttl,
      bor,
      msgId,
      retryCount,
      outbox,
      unacknowledgedSendError,
      rrReceived,
      rrTimestamp,
      msgTranslation,
      origSendTimestamp,
      isDelayed,
      wickrError,
    } = meta;

    const {
      senderUserName,
      text,
      keyVerify,
      control,
      file,
      callmessage,
      location,
      edit,
      decryptionError,
      reactionMessage,
      editContent,
      targetUsers,
      targetUsersv2,
      editTimestamp,
      inReplyTo,
      uploadErrors,
      reactions,
      isContentEdited,
      isHidden,
      forwardMessage,
    } = body;

    // Keys come with Uint8Arrays. We don't need them, and redux doesn't like non-serializable values,
    // plus it makes comparing values impossible.
    delete file?.fileMetadata?.key;
    delete file?.previewData?.key;
    delete text?.linkImageMeta?.key;
    delete callmessage?.startInfo?.meetingKey;
    control?.update?.activeMembers?.forEach((member) => {
      delete member.pubkey;
    });
    delete control?.update?.fileVaultInfo?.key;
    delete control?.leave?.roomKey;

    for (const action of control?.update?.fileVaultInfo?.action ?? []) {
      delete action.fileKey;
    }

    delete control?.recoveryResponse;
    delete keyVerify?.verifiedKey;

    if (callmessage?.summary?.callDuration) {
      callmessage.summary.callDuration = secondsToMilliseconds(callmessage.summary.callDuration);
    }

    // FIXME: Remove duplicate mentionList entries
    // https://sim.amazon.com/issues/Wickr-1688
    // Remove once mobile resolves the issue
    if (text?.mentionList) {
      text.mentionList = filterDuplicateMentions(text.mentionList);
    }

    return {
      // msgMeta
      type,
      vGroupID,
      senderHash,
      // Wickr considers messages in the outbox as unread, but that messes with our jumping to unread messages,
      // so we treat all outbox messages as read
      isRead: outbox || isRead,
      timeStamp: microsecondsToMilliseconds(timeStamp),
      timeStampMicroseconds: timeStamp,
      starred,
      destructTime: secondsToMilliseconds(destructTime),
      ttl: secondsToMilliseconds(ttl),
      bor: secondsToMilliseconds(bor),
      msgId,
      retryCount,
      outbox,
      outboxStatus,
      unacknowledgedSendError,
      rrReceived,
      rrTimestamp,
      msgTranslation,
      origSendTimestamp,
      isDelayed,
      wickrError,

      // msgBody
      senderUserName,
      text,
      keyVerify,
      control,
      file,
      callmessage,
      location,
      edit,
      decryptionError,
      reactionMessage,
      editContent,
      targetUsers,
      targetUsersv2,
      editTimestamp: editTimestamp ? microsecondsToMilliseconds(editTimestamp) : editTimestamp,
      inReplyTo,
      uploadErrors,
      reactions:
        reactions?.filter((rxn): rxn is WickrReaction => !!(rxn.identifier && rxn.userIDs)) ?? [],
      isContentEdited,
      isHidden,
      forwardMessage,

      // local props
      textContent: getMessageText(body),
      msgTranslationPending: false,
    };
  } else {
    if (__DEV__) logger.debug('MessageItem missing required fields:', { msgBody, msgMeta });
    return undefined;
  }
}

export function messageCollectionToWickrMessageCollection(
  collection: MessageCollection
): WickrMessageCollection {
  return {
    messages: collection.msgItem
      // FIXME: no need to filter here once SDK stops sending it
      .filter((item) => item.msgMeta?.type !== WickrMessageType.MsgType_Ctrl_DeleteMessage)
      .map((item) => messageItemToWickrMessage(item))
      .filter((msg): msg is WickrMessage => !!msg)
      .sort((a, b) => a.timeStamp - b.timeStamp),
    hasMoreBefore: collection.hasMoreBefore,
    hasMoreAfter: collection.hasMoreAfter,
  };
}

export function detectDuplicatedWickrMessages(
  payload: PaginatedMessagesPayload,
  collection: WickrMessageCollection
): WickrMessageCollection {
  const { messages } = collection;
  if (messages) {
    const msgIds = messages.map((m) => m.msgId);
    const uniqueMessages = new Set(msgIds);
    if (messages.length !== uniqueMessages.size) {
      logger.error('detectDuplicatedWickrMessages: found duplicated messages', payload, msgIds);
    }
  } else {
    logger.error('detectDuplicatedWickrMessages: messages is undefined');
  }
  return collection;
}

export function filterDuplicateMentions(mentionList?: WickrMessageMention[] | null) {
  if (!mentionList) return mentionList;
  const mentions = new Set<WickrMessageMention>();
  return mentionList.filter((mention) => {
    let unique = true;
    if (mention.startIndex === mention.endIndex) return false;
    for (const existingMention of mentions) {
      if (isEqual(existingMention, mention)) {
        unique = false;
        break;
      }
    }
    if (unique) mentions.add(mention);
    return unique;
  });
}

export const selectMsgId = (msg: WickrMessage) => msg.msgId;

export const selectRoomMemberId = (roomMember: MessageBody.Control.IRoomMember) =>
  roomMember.idhash;

/** Convert a list of RoomMembers into IDs, filtering out any nil data */
export function selectRoomMemberIds(roomMembers: MessageBody.Control.IRoomMember[]): string[] {
  return roomMembers
    .map((member) => {
      const id = selectRoomMemberId(member);
      if (__DEV__ && !id) {
        logger.warn('RoomMember missing idhash', member);
      }
      return id;
    })
    .filter((x): x is string => !!x);
}

// TODO: We will need a smarter serializer that includes some meta
const getMessageText = (msg: IMessageBody | null | undefined) => msg?.text?.text ?? '';

/** Check for temporary message (messages with a 64 character msgId */
export const isTemporaryMessageId = (msgId: string) => msgId.length === 64;

export const isControlMessage = (message: WickrMessage | undefined) => {
  if (!message) return false;

  if (messageIsScreenshotControlMessage(message)) return true;

  switch (message.type) {
    case WickrMessageType.MsgType_KeyVerification:
    case WickrMessageType.MsgType_Ctrl_CreateRoom:
    case WickrMessageType.MsgType_Ctrl_ModifyRoomMembers:
    case WickrMessageType.MsgType_Ctrl_LeaveRoom:
    case WickrMessageType.MsgType_Ctrl_ModifyRoomParams:
    case WickrMessageType.MsgType_Ctrl_DeleteRoom:
    case WickrMessageType.MsgType_Ctrl_RecoveryRequest:
    case WickrMessageType.MsgType_Ctrl_RecoveryResponse:
    case WickrMessageType.MsgType_Ctrl_DeleteMessage:
    case WickrMessageType.MsgType_Ctrl_MessageAttributesMsg:
    case WickrMessageType.MsgType_Ctrl_MessageAttribsSyncReq:
    case WickrMessageType.MsgType_Ctrl_ModifyPrivateProperty:
    case WickrMessageType.MsgType_Ctrl_RoomKeyRequest:
    case WickrMessageType.MsgType_Ctrl_RoomKeyResponse:
    case WickrMessageType.MsgType_Ctrl_DataRetentionPolicy:
    case WickrMessageType.MsgType_Ctrl_IdentityWarning:
      return true;
    default:
      return false;
  }
};

export const isForwardedMessage = (msg?: WickrMessage): msg is WickrForwardMessage => {
  if (!msg?.forwardMessage) {
    return false;
  }

  try {
    assertRequiredForwardMessage(msg.forwardMessage);
    return true;
  } catch {
    return false;
  }
};

export const asForwardedMessage = (msg?: WickrMessage) =>
  isForwardedMessage(msg) ? msg : undefined;

export const isTextMessage = (message: WickrMessage | undefined) => {
  if (!message) return false;
  return message.type === WickrMessageType.MsgType_Text;
};

export const isServerMessage = (message: WickrMessage | undefined) => {
  if (!message) return false;
  return !message.isAutoSummaryMessage;
};

export const isFileShareMessage = (message: WickrMessage | undefined) => {
  if (!message) return false;
  return message.type === WickrMessageType.MsgType_File_FileShare;
};

export const isCallMessage = (message: WickrMessage | undefined) => {
  if (!message) return false;
  return message.type === WickrMessageType.MsgType_Call;
};

export const isFailedMessage = (message?: WickrMessage) => {
  if (!message) return false;
  return (
    message.outboxStatus === WickrOutboxStatus.Outbox_Failed ||
    message.outboxStatus === WickrOutboxStatus.Outbox_Unsent
  );
};

export const isMessageSending = (message: WickrMessage | undefined) => {
  if (!message) return false;
  return message.outboxStatus === WickrOutboxStatus.Outbox_Sending;
};

type WickrMessageWithFile = Omit<WickrMessage, 'file'> &
  RequiredNonNullable<Pick<WickrMessage, 'file'>>;

export const messageHasFile = (message: WickrMessage): message is WickrMessageWithFile => {
  return !!message.file;
};

type WickrMessageWithFileMetadata = WickrMessageWithFile & {
  file: {
    fileMetadata: MessageBody.File.IMetadata;
  };
};

export const messageHasFileMetadata = (
  message: WickrMessage
): message is WickrMessageWithFileMetadata => {
  return !!message.file?.fileMetadata;
};

export const SUPPORTED_IMAGE_PREVIEW_TYPES = [
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/bmp',
  'image/gif',
  'image/webp',
];
export const imageFileExtPreviewSupported = (fileExt: string) => {
  return SUPPORTED_IMAGE_PREVIEW_TYPES.includes(`image/${fileExt.toLowerCase()}`);
};
export const messageHasImageAttachment = (message: WickrMessage) => {
  return (
    messageHasFileMetadata(message) &&
    SUPPORTED_IMAGE_PREVIEW_TYPES.includes(message.file.fileMetadata.mimetype ?? '')
  );
};

export const messageHasVideoAttachment = (message: WickrMessage) => {
  return (
    messageHasFileMetadata(message) && message.file.fileMetadata.mimetype?.startsWith('video/')
  );
};

type WickrMessageWithAudioMetadata = WickrMessageWithFile & {
  file: {
    audioMetadata: MessageBody.File.IAudioMeta;
  };
};

export const messageHasAudioMetadata = (
  message: WickrMessage
): message is WickrMessageWithAudioMetadata => {
  return !!message.file?.audioMetadata;
};

type WickrMessageWithImageMetadata = WickrMessageWithFile & {
  file: {
    imageMetadata: MessageBody.File.IImageMeta;
  };
};

export const messageHasImageMetadata = (
  message: WickrMessage
): message is WickrMessageWithImageMetadata => {
  return !!message.file?.imageMetadata;
};

type WickrMessageWithTableMeta = WickrMessage & {
  text: {
    tableMeta: MessageBody.Text.ITableMeta;
  };
};

export const messageHasTableMeta = (
  message: WickrMessage
): message is WickrMessageWithTableMeta => {
  return !!message.text?.tableMeta;
};

type WickrMessageWithScreenshotMeta = WickrMessageWithImageMetadata & {
  file: {
    imageMetadata: {
      screenshotMeta: MessageBody.File.IScreenshotMeta;
    };
  };
};

/** Messages with screenshotMeta are control messages, i.e. "User took a screenshot" */
export const messageIsScreenshotControlMessage = (
  message: WickrMessage
): message is WickrMessageWithScreenshotMeta => {
  return !!message.file?.imageMetadata?.screenshotMeta;
};

export const getMessageFilename = (message: WickrMessage | undefined) =>
  message?.file?.fileMetadata?.name ?? '';
