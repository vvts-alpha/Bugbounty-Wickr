import { ToolResultBlock, ToolUseBlock } from '@aws-sdk/client-bedrock-runtime';
import { clsx } from 'clsx';
import React, { useState, useRef, useEffect } from 'react';

import {
  Panel,
  PanelBody,
  Input,
  IconButton,
  CancelIcon,
  CautionIcon,
  SendIcon,
  SpinnerIcon,
} from '@/componentlibrary';
import { MarkdownText } from '@/components/MarkdownText';
import { useAwsAuth } from '@/lib/awsAuth/AwsAuthProvider';
import { Logger } from '@/lib/logger';
import { useWickrAIChat } from '@/lib/mcp/useWickrAIChat';
import { useAppDispatch, useAppSelector } from '@/store';
import { selectActiveModal } from '@/store/slices/modal';
import { clearPanelStack, popPanel, selectIsActivePanel } from '@/store/slices/panels';
import { PANEL_SIDES, WickrAIChatPanelArgs } from '@/store/slices/panels/panelsModels';
import { raw } from '@/utils/strings';
import ToolCard from './ToolCard';

import styles from './WickrAIChatPanel.module.less';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'tool';
  content: string;
  timestamp: Date;
  isStreaming?: boolean;
  toolCall?: ToolUseBlock;
  toolResult?: ToolResultBlock;
}

const logger = new Logger('WickrAIChatPanel');

/**
 * A panel to chat with Bedrock model
 * This panel will only be shown to dev and/or beta users
 */
const WickrAIChatPanel: React.FC<WickrAIChatPanelArgs> = ({
  initialMessage,
  name,
  systemPrompt,
  closeIcon,
}) => {
  const dispatch = useAppDispatch();
  const side = PANEL_SIDES[name];
  const panelIsActive = useAppSelector((state) => selectIsActivePanel(state, name));
  const activeModal = useAppSelector(selectActiveModal);

  const { isAuthenticated, activeService } = useAwsAuth();
  const {
    sendMessage,
    stopGeneration,
    isGenerating,
    connectionError,
    isReady,
    onStreamChunk,
    offStreamChunk,
  } = useWickrAIChat(
    activeService === 'cognito'
      ? { region: 'us-west-2', modelId: 'us.anthropic.claude-3-7-sonnet-20250219-v1:0' }
      : undefined
  );

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      role: 'assistant',
      content: "Hello! I'm WickrAI, your assistant. How can I help you today?",
      timestamp: new Date(),
    },
  ]);
  const [inputValue, setInputValue] = useState('');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const currentAssistantMessageIdRef = useRef<string | null>(null);
  const initialMessageSentRef = useRef<boolean>(false);

  const handleOutsideClick = () => panelIsActive && !activeModal && dispatch(clearPanelStack());

  // Set up streaming handler
  useEffect(() => {
    onStreamChunk((chunk) => {
      if (!currentAssistantMessageIdRef.current) return;

      if (chunk.type === 'content' && chunk.content) {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === currentAssistantMessageIdRef.current
              ? { ...msg, content: msg.content + chunk.content }
              : msg
          )
        );
      }

      // Handle tool calls - create a new tool message
      if (chunk.type === 'tool_call' && chunk.toolCall) {
        setMessages((prev) => {
          const updated = prev.map((msg) =>
            msg.id === currentAssistantMessageIdRef.current
              ? { ...msg, isStreaming: false } // Stop streaming on current message
              : msg
          );

          // Add tool message
          const toolMessage: ChatMessage = {
            id: `tool-${chunk.toolCall!.toolUseId}`,
            role: 'tool',
            content: '',
            timestamp: new Date(),
            toolCall: chunk.toolCall!,
            isStreaming: true, // Tool is executing
          };

          // Create new assistant message for content after tool
          const newAssistantMessageId = `${currentAssistantMessageIdRef.current}-after-${
            chunk.toolCall!.toolUseId
          }`;
          const newAssistantMessage: ChatMessage = {
            id: newAssistantMessageId,
            role: 'assistant',
            content: '',
            timestamp: new Date(),
            isStreaming: true,
          };

          // Update the current message ref to the new assistant message
          currentAssistantMessageIdRef.current = newAssistantMessageId;

          return [...updated, toolMessage, newAssistantMessage];
        });
      }

      // Handle tool results - update the corresponding tool message
      if (chunk.type === 'tool_result' && chunk.toolResult) {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.role === 'tool' && msg.toolCall?.toolUseId === chunk.toolResult!.toolUseId
              ? {
                  ...msg,
                  toolResult: chunk.toolResult!,
                  isStreaming: false, // Tool execution complete
                }
              : msg
          )
        );
      }

      // Handle cancellation
      if (chunk.type === 'cancelled') {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === currentAssistantMessageIdRef.current || msg.isStreaming
              ? { ...msg, isStreaming: false }
              : msg
          )
        );
        currentAssistantMessageIdRef.current = null;
      }
    });

    return () => {
      offStreamChunk();
    };
  }, [onStreamChunk, offStreamChunk]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input when panel opens
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Handle initial message sending
  useEffect(() => {
    if (initialMessage && !initialMessageSentRef.current && isReady) {
      initialMessageSentRef.current = true;
      sendInitialMessage(initialMessage);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialMessage, isReady]);

  const sendInitialMessage = async (message: string) => {
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: message,
      timestamp: new Date(),
    };

    // Add user message immediately
    setMessages((prev) => [...prev, userMessage]);

    try {
      // Create streaming assistant message
      const assistantMessageId = (Date.now() + 1).toString();
      currentAssistantMessageIdRef.current = assistantMessageId;

      const assistantMessage: ChatMessage = {
        id: assistantMessageId,
        role: 'assistant',
        content: '',
        timestamp: new Date(),
        isStreaming: true,
      };

      setMessages((prev) => [...prev, assistantMessage]);

      // Send message using the hook
      await sendMessage(message, {
        useTools: true,
        inferenceConfig: { maxTokens: 8192 },
      });

      // Mark all streaming messages as complete and remove empty ones
      setMessages((prev) =>
        prev
          .map((msg) => ({ ...msg, isStreaming: false }))
          .filter((msg) => !(msg.role === 'assistant' && msg.content === '' && !msg.isStreaming))
      );

      // Clear the reference
      currentAssistantMessageIdRef.current = null;
    } catch (error) {
      logger.error('Error sending initial message to WickrAI:', error);

      // Add error message
      const errorMessage: ChatMessage = {
        id: (Date.now() + 2).toString(),
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again or check your connection.',
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, errorMessage]);

      // Clear the reference on error
      currentAssistantMessageIdRef.current = null;
    }
  };
  const isSendDisabled = !inputValue.trim() || !isReady || isGenerating;
  const handleSendMessage = async () => {
    if (isSendDisabled) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: inputValue.trim(),
      timestamp: new Date(),
    };

    // Add user message immediately
    setMessages((prev) => [...prev, userMessage]);
    const currentInput = inputValue.trim();
    setInputValue('');

    try {
      // Create streaming assistant message
      const assistantMessageId = (Date.now() + 1).toString();
      currentAssistantMessageIdRef.current = assistantMessageId;

      const assistantMessage: ChatMessage = {
        id: assistantMessageId,
        role: 'assistant',
        content: '',
        timestamp: new Date(),
        isStreaming: true,
      };

      setMessages((prev) => [...prev, assistantMessage]);

      // Send message using the hook
      await sendMessage(currentInput, {
        useTools: true,
        inferenceConfig: { maxTokens: 8192 },
        systemPrompt,
      });

      // Mark all streaming messages as complete and remove empty ones
      setMessages((prev) =>
        prev
          .map((msg) => ({ ...msg, isStreaming: false }))
          .filter((msg) => !(msg.role === 'assistant' && msg.content === '' && !msg.isStreaming))
      );

      // Clear the reference
      currentAssistantMessageIdRef.current = null;
    } catch (error) {
      logger.error('Error sending message to WickrAI:', error);

      // Add error message
      const errorMessage: ChatMessage = {
        id: (Date.now() + 2).toString(),
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again or check your connection.',
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, errorMessage]);

      // Clear the reference on error
      currentAssistantMessageIdRef.current = null;
    }
  };

  const handleStopGeneration = () => {
    stopGeneration();

    // Mark the current streaming message as complete
    if (currentAssistantMessageIdRef.current) {
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === currentAssistantMessageIdRef.current ? { ...msg, isStreaming: false } : msg
        )
      );
      currentAssistantMessageIdRef.current = null;
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (isGenerating) {
        handleStopGeneration();
      } else {
        handleSendMessage();
      }
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <Panel
      onClose={() => dispatch(popPanel())}
      onOutsideClick={handleOutsideClick}
      side={side}
      className={styles.wickrAIChatPanel}
      closeIcon={closeIcon}
    >
      <PanelBody className={styles.chatBody}>
        <div className={styles.chatContainer}>
          {/* Messages Area */}
          <div className={styles.messagesArea}>
            {connectionError ? (
              <div className={styles.errorMessage}>
                <div className={styles.errorIcon}>
                  <CautionIcon width={20} height={20} variant="error" />
                </div>
                <div className={styles.errorText}>{connectionError}</div>
              </div>
            ) : (
              messages.map((message) => (
                <div
                  key={message.id}
                  className={clsx(styles.message, {
                    [styles.userMessage]: message.role === 'user',
                    [styles.assistantMessage]: message.role === 'assistant',
                    [styles.toolMessage]: message.role === 'tool',
                  })}
                >
                  <div className={styles.messageContent}>
                    {message.role === 'tool' ? (
                      // Tool message - render as card
                      <div className={styles.toolCards}>
                        <ToolCard
                          toolCall={message.toolCall!}
                          toolResult={message.toolResult}
                          isExecuting={message.isStreaming}
                        />
                      </div>
                    ) : (
                      // Regular user or assistant message
                      <div className={styles.messageText}>
                        <MarkdownText text={message.content} copyCodeBtn={true} />
                      </div>
                    )}

                    <div
                      className={clsx(styles.messageTime, {
                        [styles.withSpinner]: message.isStreaming,
                      })}
                    >
                      {message.isStreaming && (
                        <SpinnerIcon width={16} height={16} className={styles.typingIndicator} />
                      )}
                      {formatTime(message.timestamp)}
                    </div>
                  </div>
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div>
            <div className={styles.inputContainer}>
              <Input
                ref={inputRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyUp={handleKeyPress}
                placeholder={
                  isAuthenticated ? 'Ask WickrAI anything...' : 'Sign in to chat with WickrAI'
                }
                showClear={false}
                className={styles.messageInput}
              />
              <IconButton
                label={raw(isGenerating ? 'Send' : 'Stop')}
                className={styles.sendButton}
                onClick={isGenerating ? handleStopGeneration : handleSendMessage}
                aria-disabled={!isGenerating && isSendDisabled}
              >
                {isGenerating ? <CancelIcon size="20px" /> : <SendIcon size="20px" />}
              </IconButton>
            </div>
          </div>
        </div>
      </PanelBody>
    </Panel>
  );
};

export default WickrAIChatPanel;
