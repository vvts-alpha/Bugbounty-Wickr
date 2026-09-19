import {
  ConverseStreamCommand,
  ConverseStreamRequest,
  Message,
  ToolSpecification,
  ContentBlock,
  ToolUseBlock,
} from '@aws-sdk/client-bedrock-runtime';
import { ChatOptions, StreamChunk, StreamResult } from '../types';
import { redactInProd } from '@/utils/strings';
import { BaseBedrockClient } from './BaseBedrockClient';

/**
 * Bedrock Client using ConverseStream API
 * Works with all supported models (Claude, Nova, etc.) through a single interface
 */
export class BedrockClient extends BaseBedrockClient {
  protected async *sendMessageStream(
    messages: Message[],
    availableTools: ToolSpecification[] = [],
    options: ChatOptions,
    abortController: AbortController
  ): AsyncGenerator<StreamChunk, StreamResult, unknown> {
    const request: ConverseStreamRequest = {
      modelId: options.modelConfig?.modelId ?? this.modelId,
      messages: messages,
      inferenceConfig: options.inferenceConfig,
      ...(availableTools.length > 0 && {
        toolConfig: {
          tools: availableTools.map((tool) => ({ toolSpec: tool })),
          toolChoice: { auto: {} },
        },
      }),
      ...(options.systemPrompt && {
        system: [{ text: options.systemPrompt }],
      }),
    };

    this.logger.debug('ConverseStream request:', redactInProd(JSON.stringify(request, null, 2)));

    // Execute ConverseStream command
    const command = new ConverseStreamCommand(request);
    const response = await this.client!.send(command, {
      abortSignal: abortController.signal,
    });

    // Stream the response into a message following AWS example pattern
    let stopReason = '';

    const message: { content: ContentBlock[] } = { content: [] };
    let text = '';
    let toolUse: { toolUseId?: string; name?: string; input?: string } = {};

    let inputTokens = 0;
    let outputTokens = 0;

    if (response.stream) {
      for await (const chunk of response.stream) {
        // Check if abort was requested
        if (abortController.signal.aborted) {
          yield { type: 'cancelled' };
          return {
            content: text,
            usage: { inputTokens, outputTokens },
            stopReason: 'cancelled',
            toolUses: [],
          };
        }

        // Handle chunks following AWS example pattern
        if (chunk.messageStart) {
          // Message started - role is always 'assistant' for responses
          continue;
        }

        if (chunk.contentBlockStart) {
          // Content block started - handle tool use start
          const start = chunk.contentBlockStart.start;
          if (start?.toolUse) {
            toolUse.toolUseId = start.toolUse.toolUseId;
            toolUse.name = start.toolUse.name;
            toolUse.input = ''; // Initialize as empty string, will accumulate
          }
        }

        if (chunk.contentBlockDelta) {
          const delta = chunk.contentBlockDelta.delta;

          if (delta?.toolUse?.input) {
            // Tool use input delta - accumulate as string like AWS example
            if (!toolUse.input) {
              toolUse.input = '';
            }
            toolUse.input += delta.toolUse.input;
          } else if (delta?.text) {
            // Text content delta
            text += delta.text;
            yield { type: 'content', content: delta.text };
          }
        }

        if (chunk.contentBlockStop) {
          // Content block completed - finalize content
          if (toolUse.input !== undefined) {
            // Parse accumulated tool input JSON and create ToolUseBlock
            try {
              const parsedInput = toolUse.input ? JSON.parse(toolUse.input) : {};
              const toolUseBlock: ToolUseBlock = {
                toolUseId: toolUse.toolUseId || '',
                name: toolUse.name || '',
                input: parsedInput,
              };

              // Add to message content
              message.content.push({ toolUse: toolUseBlock });

              // Emit tool call
              yield { type: 'tool_call', toolCall: toolUseBlock };
            } catch (error) {
              this.logger.error('Failed to parse tool input JSON:', error);
            }

            // Reset for next tool use
            toolUse = {};
          } else if (text) {
            // Add text content to message
            message.content.push({ text: text });
          }
        }

        if (chunk.messageStop) {
          // Message completed
          stopReason = chunk.messageStop.stopReason || 'stop';
        }

        if (chunk.metadata?.usage) {
          // Usage information
          inputTokens = chunk.metadata.usage.inputTokens || 0;
          outputTokens = chunk.metadata.usage.outputTokens || 0;

          yield {
            type: 'usage',
            usage: { inputTokens, outputTokens },
            stopReason,
          };
        }
      }
    }

    // Extract tool uses from final message content
    const toolUses: ToolUseBlock[] = [];
    for (const content of message.content) {
      if (content.toolUse) {
        toolUses.push(content.toolUse);
      }
    }

    this.logger.info('ConverseStream completed');
    this.logger.debug(`Final content: ${text.length} chars, tools: ${toolUses.length}`);

    return {
      content: text,
      usage: { inputTokens, outputTokens },
      stopReason: stopReason || 'stop',
      toolUses,
    };
  }
}
