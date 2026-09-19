import { z } from 'zod';
import { WickrWebChannel } from '@/apis/webChannel';
import { getConvoListItems } from '@/apis/webFetch';
import { AppStore } from '@/store';
import { selectActiveConvoId } from '@/store/slices/shared';
import { timeToLocaleString } from '@/utils/date';
import { createTool, optNull } from '.';

// Maximum allowed expiration time (30 days in seconds)
const MAX_EXPIRATION_TIME = 30 * 24 * 60 * 60;

const WickrConvoListItemOutputSchema = {
  vgroupId: z.string().describe('Unique identifier for the conversation group'),
  convoTitle: optNull(z.string()).describe('Title or name of the conversation'),
  displayTimestamp: optNull(z.string()).describe(
    'Local time string indicates the last update time of the conversation'
  ),
  mentionCount: optNull(z.number()).describe('Number of unread mentions in this conversation'),
  unreadCount: optNull(z.number()).describe('Number of unread messages in this conversation'),
  dmUserHash: optNull(z.string()).describe(
    "User hash for direct message conversations, the convo is a DM if it's not empty"
  ),
  groupMemberCount: optNull(z.number()).describe('Number of members in group conversations'),
  isMuted: optNull(z.boolean()).describe('Whether notifications are muted for this conversation'),
};

export const getConvoListItemsTool = createTool({
  name: 'getConvoListItems',
  config: {
    description: 'Get conversation list items, optionally filtered by conversation ID',
    inputSchema: {
      vGroupID: z.string().optional().describe('Optional conversation group ID to filter by'),
    },
    outputSchema: {
      items: z
        .array(z.object(WickrConvoListItemOutputSchema))
        .describe('Array of conversation list items'),
    },
  },
  callback: async (input) => {
    const { vGroupID = '' } = input;
    return {
      items: (await getConvoListItems(vGroupID)).map((convo) => {
        const displayTimestamp = convo.displayTimestamp
          ? timeToLocaleString(convo.displayTimestamp)
          : undefined;
        return { ...convo, displayTimestamp };
      }),
    };
  },
});

export const createEditConversationTool = (webChannel: WickrWebChannel) =>
  createTool({
    name: 'editConversation',
    config: {
      description: `Edit an existing conversation (add/remove members, change title/description, etc.)`,
      inputSchema: {
        vgroupId: z.string().describe('ID of the conversation to edit'),
        addedUsers: z.array(z.string()).optional().describe('User IDs to add to the conversation'),
        deletedUsers: z
          .array(z.string())
          .optional()
          .describe('User IDs to remove from the conversation'),
        addedModerators: z.array(z.string()).optional().describe('User IDs to add as moderators'),
        deletedModerators: z
          .array(z.string())
          .optional()
          .describe('User IDs to remove as moderators'),
        title: z.string().optional().describe('New title for the conversation'),
        description: z.string().optional().describe('New description for the conversation'),
        destructionTime: z.number().optional().describe('New message destruction time in seconds'),
        burnOnRead: z.number().optional().describe('New burn on read time in seconds'),
      },
      outputSchema: {
        success: z.boolean().describe('Whether the conversation was edited successfully'),
        error: z.string().optional().describe('Error message if edit failed'),
      },
    },
    callback: async (input) => {
      try {
        // Ensure at least one edit parameter is provided
        const hasChanges = [
          input.addedUsers,
          input.deletedUsers,
          input.addedModerators,
          input.deletedModerators,
          input.title,
          input.description,
          input.destructionTime,
          input.burnOnRead,
        ].some((param) => param !== undefined);

        if (!hasChanges) {
          return {
            success: false,
            error: 'At least one edit parameter must be provided',
          };
        }

        const success = await webChannel.bridge.editConvo({
          vgroupId: input.vgroupId,
          addedUsers: input.addedUsers,
          deletedUsers: input.deletedUsers,
          addedModerators: input.addedModerators,
          deletedModerators: input.deletedModerators,
          title: input.title,
          description: input.description,
          destructionTime: input.destructionTime,
          burnOnRead: input.burnOnRead,
        });

        return {
          success,
          error: success ? undefined : 'Failed to edit conversation',
        };
      } catch (error: unknown) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error occurred',
        };
      }
    },
  });

export const createGetCurrentActiveConvoTool = (store: AppStore) =>
  createTool({
    name: 'getCurrentActiveConvo',
    config: {
      description: 'Get the currently active conversation details',
      inputSchema: {},
      outputSchema: {
        success: z
          .boolean()
          .describe('Whether the current active conversation was retrieved successfully'),
        activeConvo: z
          .object(WickrConvoListItemOutputSchema)
          .optional()
          .describe('Current active conversation details if available'),
        error: z.string().optional().describe('Error message if retrieval failed'),
      },
    },
    callback: async () => {
      try {
        // Get the current active conversation ID from the store
        const activeConvoId = selectActiveConvoId(store.getState());

        if (!activeConvoId) {
          return {
            success: true,
            activeConvo: undefined,
            error: 'No conversation is currently active',
          };
        }

        // Get conversation details using the existing getConvoListItems function
        const convoItems = await getConvoListItems(activeConvoId);

        if (convoItems.length === 0) {
          return {
            success: false,
            activeConvo: undefined,
            error: 'Active conversation not found',
          };
        }

        const activeConvo = convoItems[0];
        const displayTimestamp = activeConvo.displayTimestamp
          ? timeToLocaleString(activeConvo.displayTimestamp)
          : undefined;

        return {
          success: true,
          activeConvo: { ...activeConvo, displayTimestamp },
        };
      } catch (error: unknown) {
        return {
          success: false,
          activeConvo: undefined,
          error: error instanceof Error ? error.message : 'Unknown error occurred',
        };
      }
    },
  });

export const createCreateNewConversationTool = (webChannel: WickrWebChannel) =>
  createTool({
    name: 'createNewConversation',
    config: {
      description: `Create a new conversation (direct message, group, or room) or send a message to an existing one. If a DM with the specified user already exists, the message will be sent to that conversation. For groups and rooms, check if a conversation with that exact name already exist before creating a new one.

Room Expiration:
- If destructionTime or burnOnRead are not specified, they will be set to the maximum allowed time (30 days)
- You can specify shorter times if needed
- Time values are in seconds

IMPORTANT WORKFLOW:
1. If creating a group or room and no members are specified, use ask_followup_question to ask who should be added to the conversation.
2. Use getContactsTool to fetch available contacts if needed.
3. When asking about members, only show display names to the user, never expose internal IDs.
4. After getting member names from the user, use getContactsTool to get their internal IDs.
5. For DMs, if only a display name is provided, use getContactsTool to find the correct user ID and hash.`,
      inputSchema: {
        type: z.enum(['dm', 'group', 'room']).describe('Type of conversation to create'),
        userId: z.string().optional().describe('User ID of the recipient (for DMs)'),
        userHash: z.string().optional().describe('User hash of the recipient (for DMs)'),
        message: z.string().optional().describe('Optional initial message (for DMs)'),
        members: z
          .array(z.string())
          .optional()
          .describe('Array of member user IDs (for groups/rooms)'),
        title: z.string().optional().describe('Room title (for rooms)'),
        description: z.string().optional().describe('Room description (for rooms)'),
        destructionTime: z
          .number()
          .optional()
          .describe('Message destruction time in seconds (for rooms)'),
        burnOnRead: z.number().optional().describe('Burn on read time in seconds (for rooms)'),
      },
      outputSchema: {
        success: z.boolean().describe('Whether the conversation was created successfully'),
        vgroupId: z.string().optional().describe('ID of the created conversation if successful'),
        error: z.string().optional().describe('Error message if creation failed'),
      },
    },
    callback: async (input) => {
      try {
        switch (input.type) {
          case 'dm': {
            if (!input.userId || !input.userHash) {
              return {
                success: false,
                error: 'userId and userHash are required for DMs',
              };
            }

            try {
              // Try to get existing DM conversation
              const existingVgroupId = await webChannel.bridge.getVgroupIdFromHash({
                otherUserHash: input.userHash,
              });

              if (existingVgroupId && input.message) {
                // If DM exists and we have a message, send to existing conversation
                await webChannel.bridge.sendTextMessage({
                  vgroupId: existingVgroupId,
                  message: input.message,
                });
                return {
                  success: true,
                  vgroupId: existingVgroupId,
                };
              }
            } catch {
              // If getVgroupIdFromHash fails, proceed with creating new DM
            }

            // Create new DM if no existing conversation found
            const success = await webChannel.bridge.createDM({
              userId: input.userId,
              userHash: input.userHash,
              message: input.message || '',
            });

            return {
              success,
              error: success ? undefined : 'Failed to create direct message',
            };
          }
          case 'group': {
            if (!input.members?.length) {
              throw new Error(`INTERNAL NOTE: No members specified for group. Use ask_followup_question to ask who should be added to the group, then use getContactsTool to get their IDs. Example workflow:
1. Ask "Who would you like to add to the group?"
2. Get contacts with getContactsTool
3. Match user-provided names to contact IDs
4. Create group with matched member IDs`);
            }
            const success = await webChannel.bridge.createGroup({
              members: input.members,
            });
            return {
              success,
              error: success ? undefined : 'Failed to create group',
            };
          }
          case 'room': {
            if (!input.members?.length) {
              throw new Error(`INTERNAL NOTE: No members specified for room. Use ask_followup_question to ask who should be added to the room, then use getContactsTool to get their IDs. Example workflow:
1. Ask "Who would you like to add to the room?"
2. Get contacts with getContactsTool
3. Match user-provided names to contact IDs
4. Create room with matched member IDs`);
            }
            if (!input.title || !input.description) {
              return {
                success: false,
                error: 'Title and description are required for rooms',
              };
            }
            // Set default expiration times if not provided
            const destructionTime =
              typeof input.destructionTime === 'number'
                ? input.destructionTime
                : MAX_EXPIRATION_TIME;

            const burnOnRead =
              typeof input.burnOnRead === 'number' ? input.burnOnRead : MAX_EXPIRATION_TIME;

            const success = await webChannel.bridge.createRoom({
              members: input.members,
              roomTitle: input.title,
              roomDescription: input.description,
              destructionTime: destructionTime,
              burnOnRead: burnOnRead,
            });
            return {
              success,
              error: success ? undefined : 'Failed to create room',
            };
          }
          default: {
            return {
              success: false,
              error: 'Invalid conversation type',
            };
          }
        }
      } catch (error) {
        return {
          success: false,
          error: error?.message ?? 'Unknown error occurred',
        };
      }
    },
  });
