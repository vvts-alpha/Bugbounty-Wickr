import { z } from 'zod';
import { WickrWebChannel } from '@/apis/webChannel';
import { getConvoListItems, getPaginatedMessages } from '@/apis/webFetch';
import { AppStore } from '@/store';
import { timeToLocaleString } from '@/utils/date';
import { selectUserDisplayName } from './utils/user';
import { createTool, optNull } from '.';

const MessageSchema = z.object({
  msgId: z.string().describe('Unique identifier for the message'),
  vGroupID: z.string().describe('Conversation group ID that contains this message'),
  textContent: z.string().describe('Text content of the message'),
  timeStamp: z.string().describe('Local time when the message was sent'),
  senderHash: z.string().describe('Hash identifier of the user who sent the message'),
  userDisplayName: optNull(
    z.string().describe('Real name or nick name of the user who sent the message')
  ),
  isRead: z.boolean().describe('Whether the message has been read by the current user'),
  starred: z.boolean().describe('Whether the message is starred by the current user'),
  outbox: z.boolean().describe('Whether the message was sent by the current user'),
  type: z.number().describe('Type of message (text, file, etc.)'),
  reactions: z
    .array(
      z.object({
        identifier: z.string().describe('Emoji or reaction identifier'),
      })
    )
    .describe('Array of reactions to this message'),
});

export const createGetMessagesTool = (store: AppStore, webChannel: WickrWebChannel) =>
  createTool({
    name: 'getMessages',
    config: {
      description:
        'Get messages from a conversation using different anchor strategies. Usage examples:\n\n' +
        'To get recent messages: use anchorType "latest" with messagesBefore for how many recent messages you want\n' +
        'To get unread messages with context: use anchorType "first_unread" with messagesBefore/messagesAfter for context around unread messages\n' +
        'To get messages around a specific message: use anchorType "selected_message" with referenceMsgId and messagesBefore/messagesAfter for context',
      inputSchema: {
        convoId: z.string().describe('Conversation name (partial match) or vgroupId'),
        anchorType: z
          .enum(['latest', 'first_unread', 'selected_message'])
          .describe('Type of anchor to use for message retrieval'),
        referenceMsgId: z
          .string()
          .optional()
          .describe('Message ID to use as anchor (required for selected_message type)'),
        messagesBefore: z.number().min(0).describe('Number of messages to get before the anchor'),
        messagesAfter: z.number().min(0).describe('Number of messages to get after the anchor'),
      },
      outputSchema: {
        messages: z.array(MessageSchema).describe('Array of messages from the conversation'),
        hasMoreBefore: z.boolean().optional().describe('Whether there are more messages before'),
        hasMoreAfter: z.boolean().optional().describe('Whether there are more messages after'),
        error: z.string().optional().describe('Error message if operation failed'),
        disambiguationOptions: z
          .array(
            z.object({
              vgroupId: z.string(),
              title: z.string().nullable(),
            })
          )
          .optional()
          .describe('List of matching conversations when disambiguation is needed'),
      },
    },
    callback: async (input) => {
      const { convoId, anchorType, referenceMsgId, messagesBefore, messagesAfter } = input;

      // Validate required parameters
      if (anchorType === 'selected_message' && !referenceMsgId) {
        return {
          messages: [],
          error: 'referenceMsgId is required when anchorType is "selected_message"',
        };
      }

      const listItems = await getConvoListItems();
      // search for conversation by name
      let matchingConvos = listItems.filter((convo) => {
        if (!convo.convoTitle) return false;
        const convoTitle = convo.convoTitle.toLowerCase();
        const searchName = convoId.toLowerCase().trim();
        return convoTitle.includes(searchName);
      });

      if (matchingConvos.length === 0) {
        // search by id
        matchingConvos = listItems.filter((convo) => {
          return convo.vgroupId.toLowerCase() === convoId.toLowerCase().trim();
        });
        if (matchingConvos.length === 0) {
          return {
            messages: [],
            error: `No conversations found matching "${convoId}"`,
          };
        }
      }

      if (matchingConvos.length > 1) {
        return {
          messages: [],
          error: `Multiple conversations found matching "${convoId}". Please be more specific.`,
          disambiguationOptions: matchingConvos.map((convo) => ({
            vgroupId: convo.vgroupId,
            title: convo.convoTitle ?? null,
          })),
        };
      }

      const vgroupId = matchingConvos[0].vgroupId;
      // Determine anchor message ID based on anchor type
      let anchorMsgId: string;

      if (anchorType === 'selected_message') {
        anchorMsgId = referenceMsgId!;
      } else {
        const boundaryIds = await webChannel.bridge.getBoundaryIds({ vgroupId });

        // map anchor types to their boundary IDs and error messages
        const anchorConfig: {
          [K in typeof anchorType]: {
            id?: string;
            error: string;
          };
        } = {
          latest: {
            id: boundaryIds.newestId,
            error: 'No messages found in this conversation',
          },
          first_unread: {
            id: boundaryIds.oldestUnreadId,
            error: 'No unread messages found in this conversation',
          },
        };

        const config = anchorConfig[anchorType];
        // if getBoundaryIds returns undefined ids, return an error
        if (!config || !config.id) {
          return {
            messages: [],
            error: config?.error || 'Invalid anchor type',
          };
        }

        anchorMsgId = config.id;
      }
      // Get messages using pagination
      const messagesResponse = await getPaginatedMessages({
        vGroupID: vgroupId,
        msgId: anchorMsgId,
        before: messagesBefore,
        after: messagesAfter,
      });

      return {
        messages: messagesResponse.messages.map((msg) => {
          const timeStamp = timeToLocaleString(msg.timeStamp);
          return {
            ...msg,
            timeStamp,
            userDisplayName: selectUserDisplayName(store.getState(), msg.senderHash, msg.vGroupID),
          };
        }),
        hasMoreBefore: messagesResponse.hasMoreBefore,
        hasMoreAfter: messagesResponse.hasMoreAfter,
      };
    },
  });

export const createSendMessageTool = (webChannel: WickrWebChannel) =>
  createTool({
    name: 'sendMessage',
    config: {
      description: 'Send a text message to a conversation',
      inputSchema: {
        vgroupId: z.string().describe('Conversation group ID to send message to'),
        message: z.string().describe('Text content of the message'),
        replyTo: z.string().optional().describe('Optional message ID to reply to'),
        edit: z.string().optional().describe('Optional message ID to edit'),
      },
    },
    callback: async (input) => {
      await webChannel.bridge.sendTextMessage({ ...input });
    },
  });
