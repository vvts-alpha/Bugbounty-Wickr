import { BedrockRuntimeClient, Message, ToolSpecification } from '@aws-sdk/client-bedrock-runtime';
import { CognitoIdentityCredentialProvider } from '@aws-sdk/credential-provider-cognito-identity';
import { minutesToMilliseconds } from 'date-fns';
import { ChatOptions, StreamChunk, StreamResult } from '../types';
import { BaseAuthService } from '@/lib/awsAuth/BaseAuthService';
import { AwsCredentialIdentity } from '@/lib/awsAuth/types';
import { Logger } from '@/lib/logger';

/**
 * Abstract base class for Bedrock clients
 * Defines common interface and shared functionality
 */
export abstract class BaseBedrockClient {
  protected client: BedrockRuntimeClient | null = null;
  protected abortController: AbortController | null = null;
  protected authService: BaseAuthService;
  protected modelId: string;
  protected region: string;
  protected logger: Logger;

  constructor(authService: BaseAuthService, config: { region: string; modelId: string }) {
    this.authService = authService;
    this.region = config.region;
    this.modelId = config.modelId;
    this.logger = new Logger(this.constructor.name);
    this.initializeClient();
    this.subscribeToCredentialUpdates();

    this.logger.info('✅ Initialized');
  }

  private initializeClient(): void {
    const credentialProvider = this.authService.getCredentials();

    if (credentialProvider) {
      this.setClient(credentialProvider);
      this.logger.info('✅ Client ready');
    } else {
      this.logger.info('⏳ Waiting for credentials...');
    }
  }

  private setClient(credentials: AwsCredentialIdentity | CognitoIdentityCredentialProvider) {
    this.client = new BedrockRuntimeClient({
      region: this.region,
      credentials: credentials,
      requestHandler: {
        requestTimeout: this.getRequestTimeout(),
      },
    });
  }

  private subscribeToCredentialUpdates(): void {
    this.authService.on('TokenRefreshed', ({ provider }) => {
      this.logger.info('✅ Credentials updated');
      this.setClient(provider);
    });
    this.authService.on('LoginSuccess', ({ provider }) => {
      this.setClient(provider);
    });
    this.authService.on('AuthExpired', () => {
      this.client = null;
      this.logger.info('❌ Credentials removed');
    });
    this.authService.on('Logout', () => {
      this.client = null;
      this.logger.info('❌ Credentials removed');
    });
  }

  public isReady(): boolean {
    return this.client !== null;
  }

  public getModelId(): string {
    return this.modelId;
  }

  public setModelId(modelId: string): void {
    this.modelId = modelId;
    this.logger.info(`Model changed to: ${modelId}`);
  }

  /**
   * Get the request timeout for this client type
   * Override in subclasses to set model-specific timeouts
   */
  protected getRequestTimeout(): number {
    return minutesToMilliseconds(2);
  }

  /**
   * Stop the current streaming operation
   */
  public stopStream(): void {
    this.logger.info('⏹️ Stopping stream');
    this.abortController?.abort();
    this.abortController = null;
  }

  /**
   * Check if streaming is currently active
   */
  public isStreaming(): boolean {
    return this.abortController !== null;
  }

  /**
   * Create a new AbortController for the next streaming operation
   */
  protected createAbortController(): AbortController {
    this.abortController?.abort();

    this.abortController = new AbortController();
    return this.abortController;
  }

  /**
   * Clean up the AbortController after streaming completes
   */
  protected cleanupAbortController(): void {
    this.abortController = null;
  }

  /**
   * Stream response from messages with optional tools
   */
  async *sendMessage(
    messages: Message[],
    options: ChatOptions = {},
    availableTools: ToolSpecification[] = []
  ): AsyncGenerator<StreamChunk, StreamResult, unknown> {
    this.ensureClientReady();

    const abortController = this.createAbortController();

    try {
      return yield* this.sendMessageStream(messages, availableTools, options, abortController);
    } catch (error) {
      // Handle AbortError specifically
      if (error.name === 'AbortError' || abortController.signal.aborted) {
        this.logger.info('Stream cancelled by user');
        yield { type: 'cancelled' };
        return {
          content: '',
          usage: { inputTokens: 0, outputTokens: 0 },
          stopReason: 'cancelled',
          toolUses: [],
        };
      }

      this.logger.error('Streaming error:', error);
      throw error;
    } finally {
      this.cleanupAbortController();
    }
  }

  /**
   * Abstract method that must be implemented by subclasses
   * Contains the model-specific streaming logic
   */
  protected abstract sendMessageStream(
    messages: Message[],
    availableTools: any[],
    options: ChatOptions,
    abortController: AbortController
  ): AsyncGenerator<StreamChunk, StreamResult, unknown>;

  /**
   * Helper method to check if client is ready and throw if not
   */
  protected ensureClientReady(): void {
    if (!this.client) {
      throw new Error(`${this.constructor.name} not ready - no valid credentials available`);
    }
  }
}
