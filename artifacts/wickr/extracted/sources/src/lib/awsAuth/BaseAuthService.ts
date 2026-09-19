import { Emitter, withRetry } from '@amzn/async-utils';
import { CognitoIdentityCredentialProvider } from '@aws-sdk/credential-provider-cognito-identity';
import { minutesToMilliseconds, secondsToMilliseconds } from 'date-fns';
import { WickrWebChannel } from '@/apis/webChannel';
import { Logger } from '@/lib/logger';
import { Disposable } from '@/utils/disposable';
import { safeInterval, SafeIntervalCanceller } from '@/utils/safeInterval';
import { AwsAuthState, AwsCredentialIdentity, TokenSet, UserInfo } from './types';

export type AuthEvent = {
  TokenRefreshed: { provider: AwsCredentialIdentity | CognitoIdentityCredentialProvider };
  AuthExpired: undefined;
  LoginSuccess: {
    provider: AwsCredentialIdentity | CognitoIdentityCredentialProvider;
    tokens?: TokenSet; // For backward compatibility with CognitoAuthService
    userInfo?: UserInfo; // For backward compatibility with CognitoAuthService
  };
  Logout: undefined;
  AuthError: { error: Error };
};

// Configuration for auth service
export interface AuthServiceConfig {
  refreshThreshold: number; // milliseconds before expiry to refresh
  maxRetries: number;
}

export const DEFAULT_CONFIG: AuthServiceConfig = {
  refreshThreshold: minutesToMilliseconds(10),
  maxRetries: 3,
};

export abstract class BaseAuthService extends Emitter<AuthEvent> implements Disposable {
  protected config: AuthServiceConfig;
  protected refreshTimer: SafeIntervalCanceller | null = null;
  protected authenticationState: AwsAuthState = 'unauthenticated';
  protected logger = new Logger('BaseAuthService');
  protected abortController: AbortController;

  constructor(protected webChannel: WickrWebChannel, config?: Partial<AuthServiceConfig>) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.abortController = new AbortController();
    this.startTokenMonitoring();
  }
  // Abstract methods that each implementation must provide
  abstract startAuthentication(): Promise<void>;
  abstract refresh(): Promise<void>;
  abstract getCredentials(): AwsCredentialIdentity | CognitoIdentityCredentialProvider | undefined;

  // Template method for logout - handles common cleanup and calls derived class cleanup
  public logout(): void {
    // Common cleanup that all auth services need
    this.abortController.abort();
    this.stopTokenMonitoring();

    // Call abstract method for service-specific cleanup
    this.performLogoutCleanup();

    this.authenticationState = 'unauthenticated';
    this.emit('Logout');
  }

  // Abstract method for service-specific logout cleanup
  protected abstract performLogoutCleanup(): void;

  // Common functionality
  public isAuthenticated(): boolean {
    return this.authenticationState === 'authenticated';
  }

  public getAuthState(): AwsAuthState {
    return this.authenticationState;
  }

  protected startTokenMonitoring(): void {
    // Check every 15s
    this.refreshTimer = safeInterval(async () => {
      const authState = this.checkAndUpdateAuthState();

      if (authState === 'authenticated' && this.shouldRefreshToken()) {
        await this.refreshTokensProactively();
      }
    }, secondsToMilliseconds(15));
  }

  protected stopTokenMonitoring(): void {
    if (this.refreshTimer) {
      this.refreshTimer();
      this.refreshTimer = null;
    }
  }

  protected async refreshTokensProactively(): Promise<void> {
    const refreshWithRetry = withRetry(
      async () => {
        await this.refresh();
      },
      {
        attempts: this.config.maxRetries,
        retryDelay: (event) => Math.pow(2, event.attempt) * 1000,
        beforeRetry: (event) => {
          this.logger.error('Proactive token refresh failed:', event.error);
          this.emit('AuthError', { error: event.error as Error });
          return true;
        },
        signal: this.abortController.signal,
      }
    );

    try {
      await refreshWithRetry();
      const provider = this.getCredentials();
      if (provider) {
        this.emit('TokenRefreshed', { provider });
      }
    } catch (error) {
      // Don't emit errors or logout if the operation was aborted
      if (error instanceof Error && error.name === 'AbortError') {
        this.logger.debug('Token refresh aborted');
        return;
      }

      this.logger.error('Max refresh retries exceeded, logging out');
      this.emit('AuthExpired');
      this.logout();
    }
  }

  protected openExternalBrowser(url: string): void {
    this.webChannel.uiBridge.openLink({ link: url, showConfirmation: false });
  }

  protected abstract checkAndUpdateAuthState(): AwsAuthState;
  protected abstract shouldRefreshToken(): boolean;

  public getConfig(): AuthServiceConfig {
    return { ...this.config };
  }

  dispose(): void {
    // Abort any ongoing retry operations
    this.abortController.abort();

    this.stopTokenMonitoring();
  }
}
