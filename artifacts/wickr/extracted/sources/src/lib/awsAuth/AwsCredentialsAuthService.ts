import { withRetry } from '@amzn/async-utils';
import { WickrWebChannel } from '@/apis/webChannel';
import { getAwsCredentials } from '@/apis/webFetch';
import { Logger } from '@/lib/logger';
import { BaseAuthService, AuthServiceConfig } from './BaseAuthService';
import { AwsCredentialIdentity } from './types';

export class AwsCredentialsAuthService extends BaseAuthService {
  private currentCredentials: AwsCredentialIdentity | null = null;
  protected logger = new Logger('AwsCredentialsAuthService');

  constructor(webChannel: WickrWebChannel, config?: Partial<AuthServiceConfig>) {
    super(webChannel, config);
    this.refresh();
  }

  protected checkAndUpdateAuthState() {
    const previousState = this.authenticationState;

    if (!this.currentCredentials) {
      this.authenticationState = 'unauthenticated';
      this.refreshTokensProactively();
    } else {
      const now = new Date();
      const isCurrentlyExpired =
        this.currentCredentials.expiration && now >= this.currentCredentials.expiration;

      if (isCurrentlyExpired) {
        this.authenticationState = 'expired';
        if (previousState === 'authenticated') {
          this.emit('AuthExpired');
          this.refreshTokensProactively();
        }
      } else {
        this.authenticationState = 'authenticated';
      }
    }

    return this.authenticationState;
  }

  public shouldRefreshToken(): boolean {
    if (!this.currentCredentials?.expiration) return false;

    const timeUntilExpiry = this.currentCredentials.expiration.getTime() - Date.now();
    return timeUntilExpiry <= this.config.refreshThreshold;
  }

  public async startAuthentication(): Promise<void> {
    try {
      await this.fetchCredentials();
    } catch (error) {
      this.logger.error('Failed to start authentication:', error);
      this.emit('AuthError', { error });
    }
  }

  public async refresh(): Promise<void> {
    await this.fetchCredentials();
  }

  private async fetchCredentials(): Promise<void> {
    try {
      const credentials = await getAwsCredentials();

      // Validate required fields
      if (!credentials.accessKeyId || !credentials.secretAccessKey) {
        throw new Error('Invalid AWS credentials: missing required fields');
      }

      this.currentCredentials = credentials;
      this.authenticationState = 'authenticated';

      // Always emit LoginSuccess when credentials are successfully fetched
      this.emit('LoginSuccess', { provider: credentials });
    } catch (error) {
      this.logger.error('Failed to fetch AWS credentials:', error);
      this.currentCredentials = null;
      this.authenticationState = 'unauthenticated';
      throw error;
    }
  }

  public getCredentials(): AwsCredentialIdentity | undefined {
    return this.currentCredentials || undefined;
  }

  protected async refreshTokensProactively(): Promise<void> {
    const refreshWithRetry = withRetry(
      async () => {
        await this.refresh();
      },
      {
        attempts: Number.MAX_SAFE_INTEGER, // Retry indefinitely
        retryDelay: 30000, // Fixed 30-second retry interval
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
      // Don't emit errors if the operation was aborted
      if (error instanceof Error && error.name === 'AbortError') {
        this.logger.debug('Token refresh aborted');
        return;
      }

      this.logger.error('Unexpected error in token refresh:', error);
    }
  }

  protected performLogoutCleanup(): void {
    // Clear credentials
    this.currentCredentials = null;
  }

  // Methods for compatibility with AwsAuthProvider
  public getStoredUserInfo(): undefined {
    // AwsCredentialsAuthService doesn't store user info
  }

  // Utility method to get credential expiry info
  public getCredentialExpiryInfo(): {
    expiresAt: number | null;
    timeUntilExpiry: number | null;
    shouldRefresh: boolean;
  } {
    if (!this.currentCredentials?.expiration) {
      return {
        expiresAt: null,
        timeUntilExpiry: null,
        shouldRefresh: false,
      };
    }

    const expiresAt = this.currentCredentials.expiration.getTime();
    const timeUntilExpiry = expiresAt - Date.now();

    return {
      expiresAt,
      timeUntilExpiry,
      shouldRefresh: this.shouldRefreshToken(),
    };
  }
}
