import {
  ContentBlock,
  Message,
  ToolResultBlock,
  ToolUseBlock,
} from '@aws-sdk/client-bedrock-runtime';
import { WickrMcpClient } from '../mcp/WickrMcpClient';
import { BaseAuthService } from '@/lib/awsAuth/BaseAuthService';
import { Logger } from '@/lib/logger';
import { ToolManager } from './ToolManager';
import { BedrockClient } from './clients/BedrockClient';
import {
  BedrockModelConfig,
  ChatOptions,
  DEFAULT_MODEL_CONFIG,
  StreamChunk,
  StreamResult,
} from './types';

const logger = new Logger('ConversationManager');
/**
 * ConversationManager - Clean, stateful conversation interface
 *
 * Manages conversation history and coordinates between BedrockClient and ToolManager.
 */
export class ConversationManager {
  private messages: Message[] = [];
  private conversationId: string;
  private toolManager: ToolManager;
  private authService: BaseAuthService;
  private bedrockClient?: BedrockClient;

  constructor(
    mcpClient: WickrMcpClient,
    authService: BaseAuthService,
    private configs?: BedrockModelConfig
  ) {
    this.toolManager = new ToolManager(mcpClient);
    this.authService = authService;

    this.conversationId = this.generateConversationId();

    logger.info('✅ Conversation created:', this.conversationId);
  }

  /**
   * Send a message in this conversation
   * Automatically manages message history and handles tool calls
   */
  async *sendMessage(
    message: string,
    options: ChatOptions = {}
  ): AsyncGenerator<StreamChunk, StreamResult, unknown> {
    this.stopGeneration();
    logger.info(`Starting sendMessage for conversation ${this.conversationId}`);
    logger.info(`Message length: ${message.length} chars`);
    logger.debug('Options:', options);

    // Add user message to history - use AWS SDK format
    this.addMessage({ role: 'user', content: [{ text: message }] });
    logger.info(`Added user message to history. Total messages: ${this.messages.length}`);

    logger.info(`Sending message in conversation ${this.conversationId}`);

    // Get available tools if requested
    const availableTools =
      options.useTools && this.toolManager.hasToolsAvailable()
        ? await this.toolManager.discoverAvailableTools()
        : [];

    logger.info(`Available tools count: ${availableTools.length}`);
    if (availableTools.length > 0) {
      logger.debug('Available tools:', availableTools);
    }

    // Track response components
    let assistantContent = '';
    const toolCalls: ToolUseBlock[] = [];
    let finalResult: StreamResult | null = null;

    logger.info('Starting to stream response from BedrockClient');
    this.bedrockClient = new BedrockClient(this.authService, {
      region: options.modelConfig?.region ?? this.configs?.region ?? DEFAULT_MODEL_CONFIG.region,
      modelId:
        options.modelConfig?.modelId ?? this.configs?.modelId ?? DEFAULT_MODEL_CONFIG.modelId,
    });
    // Stream the response
    for await (const chunk of this.bedrockClient.sendMessage(
      this.messages,
      options,
      availableTools
    )) {
      // Collect assistant content
      if (chunk.type === 'content') {
        assistantContent += chunk.content || '';
      }

      // Handle tool calls
      if (chunk.type === 'tool_call' && chunk.toolCall) {
        toolCalls.push(chunk.toolCall);
        logger.info('Tool call:', chunk.toolCall);
      }

      // Store final result
      if (chunk.type === 'usage' || chunk.type === 'stop') {
        finalResult = {
          content: assistantContent,
          usage: chunk.usage || { inputTokens: 0, outputTokens: 0 },
          stopReason: chunk.stopReason || 'stop',
          toolUses: toolCalls,
        };
      }

      yield chunk;
    }

    logger.info(`Streaming completed. Assistant content length: ${assistantContent.length} chars`);
    logger.info(`Tool calls found: ${toolCalls.length}`);

    // Handle tool calls if any
    if (toolCalls.length > 0) {
      logger.info('Delegating to handleToolCalls');
      let result = yield* this.handleToolCalls(
        this.bedrockClient,
        assistantContent,
        toolCalls,
        options
      );

      // Keep handling tool calls until no more are returned
      while (result.toolUses && result.toolUses.length > 0) {
        logger.info(`Found ${result.toolUses.length} additional tool calls, continuing chain`);

        // Execute the additional tool calls
        logger.info('Executing additional tool calls via ToolManager');
        const additionalToolResults = await this.toolManager.executeToolCalls(result.toolUses);
        logger.info(
          `Additional tool execution completed. Results count: ${additionalToolResults.length}`
        );

        // Emit tool results for streaming
        for (const toolResult of additionalToolResults) {
          yield { type: 'tool_result', toolResult };
        }

        // Add tool results to history - use AWS SDK format
        const toolResultBlocks: ContentBlock[] = additionalToolResults.map((result) => ({
          toolResult: result,
        }));

        const additionalToolResultsMessage: Message = {
          role: 'user',
          content: toolResultBlocks,
        };
        this.addMessage(additionalToolResultsMessage);
        logger.info(
          `Added additional tool results to history. Total messages: ${this.messages.length}`
        );

        // Continue with follow-up response
        const availableTools =
          options.useTools && this.toolManager.hasToolsAvailable()
            ? await this.toolManager.discoverAvailableTools()
            : [];

        let followUpContent = '';
        const followUpToolCalls: ToolUseBlock[] = [];
        let followUpResult: StreamResult | null = null;
        for await (const chunk of this.bedrockClient.sendMessage(
          this.messages,
          options,
          availableTools
        )) {
          if (chunk.type === 'content') {
            followUpContent += chunk.content || '';
          }

          if (chunk.type === 'tool_call' && chunk.toolCall) {
            followUpToolCalls.push(chunk.toolCall);
            logger.info(`Additional follow-up tool call: ${chunk.toolCall.name}`);
          }

          if (chunk.type === 'usage' || chunk.type === 'stop') {
            followUpResult = {
              content: followUpContent,
              usage: chunk.usage || { inputTokens: 0, outputTokens: 0 },
              stopReason: chunk.stopReason || 'stop',
              toolUses: followUpToolCalls,
            };
          }

          yield chunk;
        }

        // Update result for next iteration
        result = followUpResult || {
          content: followUpContent,
          usage: { inputTokens: 0, outputTokens: 0 },
          stopReason: 'stop',
          toolUses: followUpToolCalls,
        };

        // Add assistant response to history
        if (followUpToolCalls.length === 0) {
          this.addMessage({ role: 'assistant', content: [{ text: followUpContent }] });
        } else {
          this.addMessage({
            role: 'assistant',
            content: this.buildMessageContent(followUpContent, followUpToolCalls),
          });
        }
      }
      return result;
    }

    // Add simple assistant response to history
    this.addMessage({ role: 'assistant', content: [{ text: assistantContent }] });
    logger.info(`Added assistant response to history. Total messages: ${this.messages.length}`);

    return (
      finalResult || {
        content: assistantContent,
        usage: { inputTokens: 0, outputTokens: 0 },
        stopReason: 'stop',
        toolUses: [],
      }
    );
  }

  /**
   * Send a message and return complete result (non-streaming wrapper)
   * Provides a simpler interface while leveraging all existing conversation management logic
   */
  async sendMessageComplete(
    message: string,
    options: ChatOptions = {},
    callbacks?: {
      onContent?: (content: string) => void;
      onToolCall?: (toolCall: ToolUseBlock) => void;
      onToolResult?: (toolResult: ToolResultBlock) => void;
    }
  ): Promise<StreamResult> {
    logger.info(`Starting sync message for conversation ${this.conversationId}`);

    try {
      // Create the async generator
      const streamGenerator = this.sendMessage(message, options);
      let finalResult: StreamResult | null = null;

      // Consume all chunks and handle callbacks
      for await (const chunk of streamGenerator) {
        // Handle content updates
        if (chunk.type === 'content' && callbacks?.onContent) {
          callbacks.onContent(chunk.content || '');
        }

        // Handle tool calls
        if (chunk.type === 'tool_call' && chunk.toolCall && callbacks?.onToolCall) {
          callbacks.onToolCall(chunk.toolCall);
        }

        // Handle tool results
        if (chunk.type === 'tool_result' && chunk.toolResult && callbacks?.onToolResult) {
          callbacks.onToolResult(chunk.toolResult);
        }

        // Store final result if this is a completion chunk
        if (chunk.type === 'usage' || chunk.type === 'stop') {
          finalResult = {
            content: '', // Will be built from chunks or fallback logic below
            usage: chunk.usage || { inputTokens: 0, outputTokens: 0 },
            stopReason: chunk.stopReason || 'stop',
            toolUses: [],
          };
        }
      }

      logger.info(`Sync message completed for conversation ${this.conversationId}`);

      // Return the final result from the generator
      if (finalResult) {
        return finalResult;
      }

      // Fallback: create result from last message if no final result was captured
      const lastMessage = this.getLastMessage();
      return {
        content: typeof lastMessage?.content === 'string' ? lastMessage.content : '',
        usage: { inputTokens: 0, outputTokens: 0 },
        stopReason: 'stop',
        toolUses: [],
      };
    } catch (error) {
      logger.error('Error in sync message:', error);
      throw error;
    }
  }

  /**
   * Handle tool calls and continue conversation
   */
  private async *handleToolCalls(
    bedrockClient: BedrockClient,
    assistantContent: string,
    toolCalls: ToolUseBlock[],
    options: ChatOptions
  ): AsyncGenerator<StreamChunk, StreamResult, unknown> {
    logger.info(`Handling ${toolCalls.length} tool calls`);
    logger.debug(
      'Tool calls:',
      toolCalls.map((tc) => ({ name: tc.name, id: tc.toolUseId }))
    );

    // Add assistant message with tool calls to history
    const assistantMessage: Message = {
      role: 'assistant',
      content: this.buildMessageContent(assistantContent, toolCalls),
    };
    this.addMessage(assistantMessage);
    logger.info(
      `Added assistant message with tool calls to history. Total messages: ${this.messages.length}`
    );

    // Execute tool calls - ToolManager now works directly with AWS SDK types
    logger.info('Executing tool calls via ToolManager');
    const toolResults = await this.toolManager.executeToolCalls(toolCalls);
    logger.info(`Tool execution completed. Results count: ${toolResults.length}`);

    // Emit tool results for streaming
    for (const toolResult of toolResults) {
      yield { type: 'tool_result', toolResult };
    }

    // Add tool results to history - use AWS SDK format directly
    const toolResultBlocks: ContentBlock[] = toolResults.map((result) => ({
      toolResult: result,
    }));

    const toolResultsMessage: Message = {
      role: 'user',
      content: toolResultBlocks,
    };
    this.addMessage(toolResultsMessage);
    logger.info(`Added tool results to history. Total messages: ${this.messages.length}`);

    // Continue conversation with tool results
    const availableTools =
      options.useTools && this.toolManager.hasToolsAvailable()
        ? await this.toolManager.discoverAvailableTools()
        : [];

    logger.info('Starting follow-up response stream after tool execution');

    // Stream the follow-up response
    let finalContent = '';
    const followUpToolCalls: ToolUseBlock[] = [];
    let finalResult: StreamResult | null = null;
    for await (const chunk of bedrockClient.sendMessage(this.messages, options, availableTools)) {
      if (chunk.type === 'content') {
        finalContent += chunk.content || '';
      }

      // Handle tool calls in follow-up response
      if (chunk.type === 'tool_call' && chunk.toolCall) {
        followUpToolCalls.push(chunk.toolCall);
        logger.info(`Follow-up tool call: ${chunk.toolCall.name}`);
      }

      if (chunk.type === 'usage' || chunk.type === 'stop') {
        finalResult = {
          content: finalContent,
          usage: chunk.usage || { inputTokens: 0, outputTokens: 0 },
          stopReason: chunk.stopReason || 'stop',
          toolUses: followUpToolCalls,
        };
      }

      yield chunk;
    }

    // Add final assistant response to history (only if no follow-up tool calls)
    if (followUpToolCalls.length === 0) {
      this.addMessage({ role: 'assistant', content: [{ text: finalContent }] });
    } else {
      // If there are follow-up tool calls, add assistant message with both content and tool calls
      this.addMessage({
        role: 'assistant',
        content: this.buildMessageContent(finalContent, followUpToolCalls),
      });
    }
    logger.info(`Follow-up response completed. Final content length: ${finalContent.length} chars`);
    logger.info(`Final message count: ${this.messages.length}`);
    logger.info('sendMessage completed successfully');

    return (
      finalResult || {
        content: finalContent,
        usage: { inputTokens: 0, outputTokens: 0 },
        stopReason: 'stop',
        toolUses: [],
      }
    );
  }

  /**
   * Get conversation history
   */
  getMessages(): Message[] {
    return [...this.messages];
  }

  /**
   * Get conversation ID
   */
  getConversationId(): string {
    return this.conversationId;
  }

  /**
   * Clear conversation history
   */
  clearHistory(): void {
    this.messages = [];
    logger.info(`History cleared for conversation ${this.conversationId}`);
  }

  /**
   * Get message count
   */
  getMessageCount(): number {
    return this.messages.length;
  }

  /**
   * Get last message
   */
  getLastMessage(): Message | null {
    return this.messages.length > 0 ? this.messages[this.messages.length - 1] : null;
  }

  /**
   * Stop the current generation
   */
  stopGeneration(): void {
    logger.info(`⏹️ Stopping generation for conversation ${this.conversationId}`);
    this.bedrockClient?.stopStream();
  }

  /**
   * Private helper methods
   */
  private generateConversationId(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 15);
    return `conv_${timestamp}_${random}`;
  }

  private addMessage(message: Message): void {
    this.messages.push(message);
  }

  private buildMessageContent(assistantContent: string, toolCalls: ToolUseBlock[]): ContentBlock[] {
    const content: ContentBlock[] = [];

    // Add text content if exists
    if (assistantContent && assistantContent.trim()) {
      content.push({ text: assistantContent });
    }

    // Add tool calls
    toolCalls.forEach((toolCall) => {
      content.push({
        toolUse: {
          toolUseId: toolCall.toolUseId,
          name: toolCall.name,
          input: toolCall.input,
        },
      });
    });

    return content;
  }
}
