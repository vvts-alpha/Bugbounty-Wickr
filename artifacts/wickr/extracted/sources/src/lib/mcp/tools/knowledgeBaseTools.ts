import {
  BedrockAgentClient,
  ListKnowledgeBasesCommand,
  ListKnowledgeBasesCommandOutput,
} from '@aws-sdk/client-bedrock-agent';

import {
  BedrockAgentRuntimeClient,
  RetrieveCommand,
  RetrieveCommandOutput,
} from '@aws-sdk/client-bedrock-agent-runtime';
import z from 'zod';

import { CompositeAuthService } from '@/lib/awsAuth/CompositeAuthService';
import { createTool } from '.';

export const listKnowledgeBasesTool = createTool({
  name: 'listKnowledgeBases',
  config: {
    description: 'List available bedrock knowledge bases',
    inputSchema: {
      region: z.string(),
    },
    outputSchema: {
      res: z.custom<ListKnowledgeBasesCommandOutput>(),
    },
  },
  callback: async (input) => {
    const creds = CompositeAuthService.getInstance().getCredentials();
    const client = new BedrockAgentClient({
      region: input.region,
      credentials: creds,
    });
    const command = new ListKnowledgeBasesCommand();
    const res = await client.send(command);
    return { res };
  },
});

export const queryKnowledgeBaseTool = createTool({
  name: 'queryKnowledgeBase',
  config: {
    description: 'Retrieve information from a bedrock knowledge base',
    inputSchema: {
      region: z.string(),
      knowledgeBaseId: z.string(),
      retrievalQuery: z.object({ text: z.string() }),
    },
    outputSchema: {
      res: z.custom<RetrieveCommandOutput>(),
    },
  },
  callback: async (input) => {
    const creds = CompositeAuthService.getInstance().getCredentials();
    const client = new BedrockAgentRuntimeClient({
      region: input.region,
      credentials: creds,
    });
    const command = new RetrieveCommand({
      knowledgeBaseId: input.knowledgeBaseId,
      retrievalQuery: input.retrievalQuery,
    });
    const res = await client.send(command);
    return { res };
  },
});
