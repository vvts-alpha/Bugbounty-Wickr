import { z } from 'zod';
import { getUser, getSelfUser, getContacts, getConvoUsers } from '../../../apis/webFetch';
import { createTool, optNull } from '.';

const WickrUserOutputSchema = {
  idHash: z.string().describe('User hash identifier'),
  name: optNull(z.string()).describe('Display name of the user'),
  customName: optNull(z.string()).describe('Custom name for the user'),
  blocked: z.boolean().describe('Blocked status'),
  inactive: z.boolean().describe('Account status'),
  selfUser: z.boolean().describe('Is current user'),
  isGuest: z.boolean().describe('Guest status'),
  timeIdle: z.number(),
  isBot: z.boolean(),
  inNetwork: optNull(z.boolean()).describe('Network membership'),
  verificationStatus: optNull(z.number()).describe('Verification status'),
};

export const getUserTool = createTool({
  name: 'getUser',
  config: {
    description: 'Get user information by user ID hash',
    inputSchema: {
      userIdHash: z.string().describe('The user ID hash to lookup, do not expose in chat'),
    },
    outputSchema: WickrUserOutputSchema,
  },
  callback: async (input) => {
    const { userIdHash } = input;
    const user = await getUser(userIdHash);
    if (!user) {
      throw new Error(`User ${userIdHash} not found`);
    }
    return user;
  },
});

export const getSelfUserTool = createTool({
  name: 'getSelfUser',
  config: {
    description: 'Get the current user information.',
    inputSchema: {},
    outputSchema: WickrUserOutputSchema,
  },
  callback: async () => {
    const user = await getSelfUser();
    if (!user) {
      throw new Error(`selfUser not found`);
    }
    return user;
  },
});

export const getContactsTool = createTool({
  name: 'getContacts',
  config: {
    description: 'Get all contacts for the current user.',
    inputSchema: {},
    outputSchema: {
      contacts: z.array(z.object(WickrUserOutputSchema)).describe('Array of contact users'),
    },
  },
  callback: async () => {
    return { contacts: await getContacts() };
  },
});

export const getConvoUsersTool = createTool({
  name: 'getConvoUsers',
  config: {
    description: 'Get all users in a conversation.',
    inputSchema: {
      vGroupID: z.string().describe('The conversation group ID'),
    },
    outputSchema: {
      users: z
        .array(z.object(WickrUserOutputSchema))
        .describe('Array of users in the conversation'),
    },
  },
  callback: async (input) => {
    const { vGroupID } = input;
    return { users: await getConvoUsers(vGroupID) };
  },
});
