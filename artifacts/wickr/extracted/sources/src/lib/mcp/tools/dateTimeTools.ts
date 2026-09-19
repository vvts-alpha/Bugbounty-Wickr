import { z } from 'zod';

import { timeToLocaleString } from '@/utils/date';

import { createTool } from '.';

export const getCurrentDateTimeTool = createTool({
  name: 'getCurrentDateTime',
  config: {
    description: 'Get the current date and time in both readable format and unix timestamp',
    inputSchema: {},
    outputSchema: {
      unixTimestamp: z.number().describe('Current unix timestamp in milliseconds'),
      readableString: z.string().describe('Human-readable date and time string'),
    },
  },
  callback: async () => {
    const now = Date.now();
    const readable = timeToLocaleString(now);

    return {
      unixTimestamp: now,
      readableString: readable,
    };
  },
});
