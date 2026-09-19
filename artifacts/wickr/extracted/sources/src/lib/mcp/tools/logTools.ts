import { z } from 'zod';
import { AppStore } from '@/store';
import { createTool } from '.';

export const createSIMFromMessageTool = (store: AppStore) =>
  createTool({
    name: 'createSIMFromMessage',
    config: {
      description:
        'Create a SIM (Service Issue Management) ticket from a specific message by opening WickrAI Chat with predefined instructions',
      inputSchema: {
        msgId: z.string().describe('The message ID to create SIM from'),
        vGroupID: z.string().describe('The conversation group ID containing the message'),
        messageTimeStamp: z.number().describe('Unix timestamp of the message'),
      },
    },
    callback: async (input) => {
      const { msgId, vGroupID, messageTimeStamp } = input;

      // Create the predefined message template similar to the context menu
      const predefinedMessage = `
Get 5 messages before and 5 messages after message X (ID: ${msgId}) from conversation ${vGroupID}.
CRITICAL: Only include information directly related to the issue in message X. Ignore all unrelated content from surrounding messages.
Tasks:

Summary: Create a focused summary of the issue from message X using only related information. Maximum 2000 characters.
Title: Create a ticket title for the issue. Maximum 200 characters.
Reproduction Steps: Include reproduction steps only if they exist in the surrounding messages. If not found, leave empty. Do not create or infer steps.
User Log: Try to get user logs use tool, only if the sender id match self user id.
SIM: Create a SIM using the above information. Convert timestamp ${messageTimeStamp} to human-readable format. Only create SIM if message X has meaningful content.

FILTERING RULE: Before including anything, ask "Does this directly relate to the issue in message X?" If no, exclude it.
        `.trim();

      // Open WickrAI Chat with the predefined message via UI bridge, TODO: Uncomment this once we have chat panel
      // await store.dispatch(openWickrAIChatWithMessage(predefinedMessage));
    },
  });
