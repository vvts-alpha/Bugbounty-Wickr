import {
  TokenUsage,
  StopReason,
  ToolUseBlock,
  ToolResultBlock,
  InferenceConfiguration,
} from '@aws-sdk/client-bedrock-runtime';

// Unified streaming chunk type that works with ConverseStream API
export interface StreamChunk {
  type: 'content' | 'tool_call' | 'tool_result' | 'usage' | 'stop' | 'cancelled';
  content?: string;
  toolCall?: ToolUseBlock;
  toolResult?: ToolResultBlock;
  usage?: {
    inputTokens: number;
    outputTokens: number;
  };
  stopReason?: string;
}

// Final result from streaming operation
export interface StreamResult {
  content: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
  };
  stopReason: string;
  toolUses?: ToolUseBlock[];
}

// Chat options that align with AWS SDK InferenceConfiguration
export interface ChatOptions {
  useTools?: boolean;
  modelConfig?: BedrockModelConfig;
  stream?: boolean;
  systemPrompt?: string;
  inferenceConfig?: InferenceConfiguration;
}

export interface BedrockStreamResult {
  finalContent: string;
  toolUses: ToolUseBlock[];
  usage: TokenUsage;
  stopReason: StopReason;
}

type AWSRegion = 'us-east-1' | 'us-east-2' | 'us-west-2';

// TODO: get valid models from AWS account
const bedrockModelsByRegion = {
  'us-east-1': [
    'us.anthropic.claude-3-haiku-20240307-v1:0',
    'us.anthropic.claude-3-opus-20240229-v1:0',
    'us.anthropic.claude-3-sonnet-20240229-v1:0',
    'us.anthropic.claude-3-5-haiku-20241022-v1:0',
    'us.anthropic.claude-3-5-sonnet-20240620-v1:0',
    'us.anthropic.claude-3-5-sonnet-20241022-v2:0',
    'us.anthropic.claude-3-7-sonnet-20250219-v1:0',
    'us.anthropic.claude-opus-4-20250514-v1:0',
    'us.anthropic.claude-sonnet-4-20250514-v1:0',
    'us.deepseek.r1-v1:0',
    'us.meta.llama4-maverick-17b-instruct-v1:0',
    'us.meta.llama4-scout-17b-instruct-v1:0',
    'us.meta.llama3-1-70b-instruct-v1:0',
    'us.meta.llama3-1-8b-instruct-v1:0',
    'us.meta.llama3-2-11b-instruct-v1:0',
    'us.meta.llama3-2-1b-instruct-v1:0',
    'us.meta.llama3-2-3b-instruct-v1:0',
    'us.meta.llama3-2-90b-instruct-v1:0',
    'us.meta.llama3-3-70b-instruct-v1:0',
    'us.mistral.pixtral-large-2502-v1:0',
    'us.amazon.nova-lite-v1:0',
    'us.amazon.nova-micro-v1:0',
    'us.amazon.nova-premier-v1:0',
    'us.amazon.nova-pro-v1:0',
  ],
  'us-east-2': [
    'us.anthropic.claude-3-5-haiku-20241022-v1:0',
    'us.anthropic.claude-3-5-sonnet-20241022-v2:0',
    'us.anthropic.claude-3-7-sonnet-20250219-v1:0',
    'us.anthropic.claude-opus-4-20250514-v1:0',
    'us.anthropic.claude-sonnet-4-20250514-v1:0',
    'us.deepseek.r1-v1:0',
    'us.meta.llama4-maverick-17b-instruct-v1:0',
    'us.meta.llama4-scout-17b-instruct-v1:0',
    'us.meta.llama3-1-70b-instruct-v1:0',
    'us.meta.llama3-1-8b-instruct-v1:0',
    'us.meta.llama3-3-70b-instruct-v1:0',
    'us.mistral.pixtral-large-2502-v1:0',
    'us.amazon.nova-lite-v1:0',
    'us.amazon.nova-micro-v1:0',
    'us.amazon.nova-premier-v1:0',
    'us.amazon.nova-pro-v1:0',
  ],
  'us-west-2': [
    'us.anthropic.claude-3-haiku-20240307-v1:0',
    'us.anthropic.claude-3-opus-20240229-v1:0',
    'us.anthropic.claude-3-sonnet-20240229-v1:0',
    'us.anthropic.claude-3-5-haiku-20241022-v1:0',
    'us.anthropic.claude-3-5-sonnet-20240620-v1:0',
    'us.anthropic.claude-3-5-sonnet-20241022-v2:0',
    'us.anthropic.claude-3-7-sonnet-20250219-v1:0',
    'us.anthropic.claude-opus-4-20250514-v1:0',
    'us.anthropic.claude-sonnet-4-20250514-v1:0',
    'us.deepseek.r1-v1:0',
    'us.meta.llama4-maverick-17b-instruct-v1:0',
    'us.meta.llama4-scout-17b-instruct-v1:0',
    'us.meta.llama3-1-70b-instruct-v1:0',
    'us.meta.llama3-1-8b-instruct-v1:0',
    'us.meta.llama3-2-11b-instruct-v1:0',
    'us.meta.llama3-2-1b-instruct-v1:0',
    'us.meta.llama3-2-3b-instruct-v1:0',
    'us.meta.llama3-2-90b-instruct-v1:0',
    'us.meta.llama3-3-70b-instruct-v1:0',
    'us.mistral.pixtral-large-2502-v1:0',
    'us.amazon.nova-lite-v1:0',
    'us.amazon.nova-micro-v1:0',
    'us.amazon.nova-premier-v1:0',
    'us.amazon.nova-pro-v1:0',
  ],
} as const satisfies Record<AWSRegion, readonly string[]>;

export type BedrockModelConfig<T extends AWSRegion = AWSRegion> = {
  region: T;
  modelId: (typeof bedrockModelsByRegion)[T][number];
};

export const DEFAULT_MODEL_CONFIG: BedrockModelConfig = {
  region: 'us-west-2',
  // Adjust it based on current service quota for non-prod accounts, https://tiny.amazon.com/ypn1bvo3/IsenLink
  modelId: 'us.anthropic.claude-3-7-sonnet-20250219-v1:0',
};
