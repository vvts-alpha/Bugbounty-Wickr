import { createEntityAdapter, EntityState, PayloadAction } from '@reduxjs/toolkit';
import { selectMsgId, WickrMessage } from '@/lib/protobuf/messages';

export type WithMessagesEntities = {
  messages: EntityState<WickrMessage, string>;
  lastMessagesUpdateReason?: MessagesUpdateReason;
};

export type MessagesUpdateReason =
  | 'initialRendering' // happens when user enters convo or jump to a message not in view
  | 'newMessage' // when we receive a new message from signal, can be either temp or perm message
  | 'getQuotedMessage' // when rendering quoted message within another message
  | 'updateMessage' // when we receive message update from signal
  | 'deleteMessage' // user deletes a message
  | 'trimLeadingMessages' // remove messages when messages count exceeds limit
  | 'trimTrailingMessages' // remove messages when messages count exceeds limit
  | 'fetchOlderMessages' // user scrolls up to load more messages
  | 'fetchNewerMessages'; // user scrolls down to load more messages

export const messagesAdapter = createEntityAdapter<WickrMessage, string>({
  sortComparer: (a, b) => a.timeStamp - b.timeStamp,
  selectId: selectMsgId,
});

export type MessagesPayloadAction = PayloadAction<{
  vGroupID: string;
  messages: WickrMessage[];
  reason: MessagesUpdateReason;
}>;
