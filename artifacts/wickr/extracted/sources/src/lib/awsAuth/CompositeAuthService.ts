import { CognitoIdentityCredentialProvider } from '@aws-sdk/credential-provider-cognito-identity';
import { WickrWebChannel } from '@/apis/webChannel';
import { Logger } from '@/lib/logger';
import { Disposable } from '@/utils/disposable';
import { AwsCredentialsAuthService } from './AwsCredentialsAuthService';
import { BaseAuthService, AuthServiceConfig, DEFAULT_CONFIG } from './BaseAuthService';
import { CognitoAuthService } from './CognitoAuthService';
import { AwsAuthState, AwsCredentialIdentity, TokenSet, UserInfo } from './types';

export interface CompositeAuthServiceConfig extends AuthServiceConfig {
  cognitoConfig?: Partial<AuthServiceConfig>;
  awsCredentialsConfig?: Partial<AuthServiceConfig>;
}
export type AuthServiceType = 'aws' | 'cognito';
export class CompositeAuthService extends BaseAuthService implements Disposable {
  private static instance: CompositeAuthService;
  private awsCredentialsService: AwsCredentialsAuthService;
  private cognitoService: CognitoAuthService;
  private activeService: AuthServiceType = 'aws';
  private compositeConfig: CompositeAuthServiceConfig;
  protected logger = new Logger('CompositeAuthService');

  public static getInstance(
    webChannel?: WickrWebChannel,
    config?: Partial<CompositeAuthServiceConfig>
  ) {
    if (!CompositeAuthService.instance) {
      if (!webChannel) {
        throw new Error('webChannel is required to create CompositeAuthService');
      }
      CompositeAuthService.instance = new CompositeAuthService(webChannel, config);
    }
    return CompositeAuthService.instance;
  }

  private constructor(webChannel: WickrWebChannel, config?: Partial<CompositeAuthServiceConfig>) {
    super(webChannel, config);

    this.compositeConfig = {
      ...DEFAULT_CONFIG,
      ...config,
    };

    this.awsCredentialsService = new AwsCredentialsAuthService(
      webChannel,
      this.compositeConfig.awsCredentialsConfig
    );

    this.cognitoService = new CognitoAuthService(webChannel, this.compositeConfig.cognitoConfig);

    // Determine initial active service based on existing authentication
    this.determineInitialActiveService();
    this.setupEventForwarding();
  }

  private determineInitialActiveService(): void {
    // Check if user has existing Cognito authentication
    const cognitoState = this.cognitoService.getAuthState();

    // If Cognito is authenticated, use Cognito
    if (cognitoState === 'authenticated') {
      this.activeService = 'cognito';
    } else {
      // Otherwise, use AWS Credentials as default
      this.activeService = 'aws';
    }
  }

  private setupEventForwarding(): void {
    // Forward AWS Credentials service events
    this.awsCredentialsService.on('TokenRefreshed', (data) => {
      if (this.activeService === 'aws') this.emit('TokenRefreshed', data);
    });
    this.awsCredentialsService.on('AuthExpired', () => {
      if (this.activeService === 'aws') this.emit('AuthExpired');
    });
    this.awsCredentialsService.on('LoginSuccess', (data) => {
      if (this.activeService === 'aws') this.emit('LoginSuccess', data);
    });
    this.awsCredentialsService.on('Logout', () => {
      if (this.activeService === 'aws') this.emit('Logout');
    });
    this.awsCredentialsService.on('AuthError', (data) => {
      if (this.activeService === 'aws') this.emit('AuthError', data);
    });

    // Forward Cognito service events with custom handlers for fallback scenarios
    if (this.cognitoService) {
      this.cognitoService.on('TokenRefreshed', (data) => {
        if (this.activeService === 'aws') {
          this.switchToCognito();
        }
        this.emit('TokenRefreshed', data);
      });
      this.cognitoService.on('LoginSuccess', (data) => {
        if (this.activeService === 'aws') {
          this.switchToCognito();
        }
        this.emit('LoginSuccess', data);
      });

      // Special handling for Cognito AuthExpired - fallback to AWS
      this.cognitoService.on('AuthExpired', () => {
        if (this.activeService === 'cognito') {
          this.fallbackToAwsCredentials();
        }
      });

      // Special handling for Cognito Logout - switch to AWS
      this.cognitoService.on('Logout', () => {
        if (this.activeService === 'cognito') {
          this.fallbackToAwsCredentials();
        }
      });
    }
  }

  private fallbackToAwsCredentials(): void {
    this.activeService = 'aws';

    // Emit appropriate events based on AWS service state
    const awsState = this.awsCredentialsService.getAuthState();
    if (awsState === 'authenticated') {
      const provider = this.awsCredentialsService.getCredentials();
      if (provider) {
        this.emit('LoginSuccess', { provider });
      }
    } else if (awsState === 'expired') {
      this.emit('AuthExpired');
    }
  }

  private switchToCognito(): void {
    this.activeService = 'cognito';
  }

  protected shouldRefreshToken(): boolean {
    const currentService = this.getCurrentService();
    return currentService.shouldRefreshToken();
  }

  private getCurrentService(): AwsCredentialsAuthService | CognitoAuthService {
    return this.activeService === 'cognito' ? this.cognitoService : this.awsCredentialsService;
  }

  public async startAuthentication(): Promise<void> {
    // Only cognito auth needs manual authentication
    await this.cognitoService.startAuthentication();
  }

  public async refresh(): Promise<void> {
    const currentService = this.getCurrentService();

    try {
      await currentService.refresh();
    } catch (error) {
      // If Cognito refresh fails, fall back to AWS Credentials
      if (this.activeService === 'cognito') {
        this.logger.info('Cognito refresh failed, falling back to AWS Credentials:', error);
        this.fallbackToAwsCredentials();
        return;
      }
      throw error;
    }
  }

  protected checkAndUpdateAuthState(): AwsAuthState {
    return this.getAuthState();
  }

  public getAuthState(): AwsAuthState {
    return this.getCurrentService().getAuthState();
  }

  public getCredentials(): AwsCredentialIdentity | CognitoIdentityCredentialProvider | undefined {
    return this.getCurrentService().getCredentials();
  }

  protected performLogoutCleanup(): void {
    // Logout from both services
    this.awsCredentialsService.logout();
    this.cognitoService.logout();

    // Reset to default state
    this.activeService = 'aws';
  }

  public getStoredUserInfo(): UserInfo | undefined {
    const currentService = this.getCurrentService();
    if ('getStoredUserInfo' in currentService) {
      return currentService.getStoredUserInfo();
    }
  }

  // Cognito-specific methods (delegate to cognito service if active)
  public async handleAuthCallback(callbackUrl: string): Promise<TokenSet | undefined> {
    return await this.cognitoService.handleAuthCallback(callbackUrl);
  }

  public async getValidAccessToken(): Promise<string | null> {
    if (this.activeService === 'cognito' && this.cognitoService) {
      try {
        return await this.cognitoService.getValidAccessToken();
      } catch (error) {
        this.logger.info(
          'Failed to get valid access token from Cognito, falling back to AWS Credentials:',
          error
        );
        this.fallbackToAwsCredentials();
        return null;
      }
    }
    return null; // AWS Credentials service doesn't provide access tokens
  }

  public getActiveServiceType() {
    return this.activeService;
  }

  // Utility methods for debugging/monitoring
  public getServiceStates(): {
    active: 'aws' | 'cognito';
    aws: AwsAuthState;
    cognito: AwsAuthState | null;
  } {
    return {
      active: this.activeService,
      aws: this.awsCredentialsService.getAuthState(),
      cognito: this.cognitoService?.getAuthState() ?? null,
    };
  }

  public dispose(): void {
    super.dispose();
    this.awsCredentialsService.dispose();
    this.cognitoService.dispose();
  }
}
