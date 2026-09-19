import { ToolResultBlock, ToolUseBlock } from '@aws-sdk/client-bedrock-runtime';
import { useState, useEffect, useRef, useContext } from 'react';
import { useAwsAuth } from '../awsAuth/AwsAuthProvider';
import { ConversationManager } from '../bedrock/ConversationManager';
import { BedrockModelConfig, ChatOptions, StreamChunk, StreamResult } from '../bedrock/types';
import useLatestCallback from '@/hooks/useLatestCallback';
import { safeStringify } from '@/utils/strings';
import { WickrMcpContext } from './WickrMcpContext';

type ChatStatus = 'idle' | 'ready' | 'generating' | 'error';

interface ChatState {
  status: ChatStatus;
  error: string | null;
  conversationManager: ConversationManager | null;
}

export function useWickrAIChat(
  modelConfig?: BedrockModelConfig,
  stateless = false,
  useTools = true
) {
  const { isAuthenticated, authService } = useAwsAuth();
  const { client } = useContext(WickrMcpContext);

  const [state, setState] = useState<ChatState>({
    status: 'idle',
    error: null,
    conversationManager: null,
  });

  // Stream chunk handler
  const streamHandlerRef = useRef<((chunk: StreamChunk) => void) | null>(null);

  // Initialize conversation manager
  useEffect(() => {
    if (!isAuthenticated || !client || !authService) {
      setState({
        status: 'error',
        error: 'Please sign in to chat with WickrAI.',
        conversationManager: null,
      });
      return;
    }

    try {
      const manager = new ConversationManager(client, authService, modelConfig);

      setState({
        status: 'ready',
        error: null,
        conversationManager: manager,
      });
    } catch (error) {
      setState({
        status: 'error',
        error: `Failed to connect to WickrAI: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
        conversationManager: null,
      });
    }

    // Cleanup function
    return () => {
      setState((prev) => {
        prev.conversationManager?.stopGeneration();
        return { ...prev, conversationManager: null };
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, client, authService, safeStringify(modelConfig)]);

  // Shared message sending logic
  const executeChatOperation = useLatestCallback(
    async <T>(operation: () => Promise<T>, errorPrefix: string): Promise<T> => {
      if (!state.conversationManager || state.status === 'generating') {
        throw new Error('ConversationManager not ready or already generating');
      }

      setState((prev) => ({ ...prev, status: 'generating', error: null }));

      try {
        const result = await operation();
        setState((prev) => ({ ...prev, status: 'ready' }));
        return result;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        setState((prev) => ({
          ...prev,
          status: 'error',
          error: `${errorPrefix}: ${errorMessage}`,
        }));
        throw error;
      }
    }
  );

  // Send message with streaming support
  const sendMessage = useLatestCallback(
    async (message: string, options: ChatOptions = { useTools }): Promise<StreamResult> => {
      return executeChatOperation(async () => {
        let fullContent = '';
        let finalUsage = { inputTokens: 0, outputTokens: 0 };
        let finalStopReason = 'stop';
        const toolUses: ToolUseBlock[] = [];
        console.warn('maxTokens', options.inferenceConfig?.maxTokens);
        for await (const chunk of state.conversationManager!.sendMessage(message, options)) {
          // Forward chunk to external handler if set
          streamHandlerRef.current?.(chunk);

          // Handle cancellation
          if (chunk.type === 'cancelled') {
            finalStopReason = 'cancelled';
            break;
          }

          // Accumulate content
          if (chunk.type === 'content' && chunk.content) {
            fullContent += chunk.content;
          }

          // Track tool calls
          if (chunk.type === 'tool_call' && chunk.toolCall) {
            toolUses.push(chunk.toolCall);
          }

          // Capture usage and stop reason
          if (chunk.type === 'usage' && chunk.usage) {
            finalUsage = chunk.usage;
          }

          if (chunk.stopReason) {
            finalStopReason = chunk.stopReason;
          }
        }

        // Clear history after each message in stateless mode
        if (stateless) {
          state.conversationManager!.clearHistory();
        }

        return {
          content: fullContent,
          usage: finalUsage,
          stopReason: finalStopReason,
          toolUses: toolUses.length > 0 ? toolUses : undefined,
        };
      }, 'Failed to send message');
    }
  );

  // Send message and return complete result
  const sendMessageComplete = useLatestCallback(
    async (
      message: string,
      options: ChatOptions = { useTools },
      callbacks?: {
        onContent?: (content: string) => void;
        onToolCall?: (toolCall: ToolUseBlock) => void;
        onToolResult?: (toolResult: ToolResultBlock) => void;
      }
    ): Promise<StreamResult> => {
      return executeChatOperation(
        () => state.conversationManager!.sendMessageComplete(message, options, callbacks),
        'Failed to send message'
      );
    }
  );

  // Stop generation method
  const stopGeneration = useLatestCallback(() => {
    state.conversationManager?.stopGeneration();
    setState((prev) => ({ ...prev, status: 'ready' }));
  });

  // Conversation management methods
  const clearHistory = () => state.conversationManager?.clearHistory();
  const getMessages = () => state.conversationManager?.getMessages() ?? [];
  const getMessageCount = () => state.conversationManager?.getMessageCount() ?? 0;

  // Stream handler management
  const onStreamChunk = (handler: (chunk: StreamChunk) => void) => {
    streamHandlerRef.current = handler;
  };

  const offStreamChunk = () => {
    streamHandlerRef.current = null;
  };

  return {
    sendMessage,
    sendMessageComplete,
    stopGeneration,
    isGenerating: state.status === 'generating',
    conversationManager: state.conversationManager,
    connectionError: state.error,
    isReady: state.status === 'ready',
    clearHistory,
    getMessages,
    getMessageCount,
    onStreamChunk,
    offStreamChunk,
  };
}
