import {
  CognitoIdentityCredentialProvider,
  fromCognitoIdentityPool,
} from '@aws-sdk/credential-provider-cognito-identity';
import { WickrWebChannel } from '@/apis/webChannel';
import { Logger } from '@/lib/logger';
import { redactInProd } from '@/utils/strings';
import { BaseAuthService, AuthServiceConfig } from './BaseAuthService';
import { authConfig, STORAGE_KEYS } from './config';
import { TokenSet, UserInfo } from './types';

export class CognitoAuthService extends BaseAuthService {
  protected logger = new Logger('CognitoAuthService');

  constructor(webChannel: WickrWebChannel, config?: Partial<AuthServiceConfig>) {
    super(webChannel, config);
    this.checkAndUpdateAuthState();
  }

  protected checkAndUpdateAuthState() {
    const tokens = this.getStoredTokens();

    if (!tokens) {
      this.authenticationState = 'unauthenticated';
    } else {
      const isCurrentlyExpired = Date.now() >= tokens.expires_at;

      if (isCurrentlyExpired) {
        if (this.authenticationState !== 'expired') {
          this.authenticationState = 'expired';
          this.emit('AuthExpired');
        }
      } else {
        this.authenticationState = 'authenticated';
      }
    }

    return this.authenticationState;
  }

  public shouldRefreshToken(): boolean {
    const tokens = this.getStoredTokens();
    if (!tokens) return false;

    const timeUntilExpiry = tokens.expires_at - Date.now();
    return timeUntilExpiry <= this.config.refreshThreshold;
  }

  public async startAuthentication(): Promise<void> {
    try {
      // Build authorization URL
      const authUrl = this.buildAuthUrl();

      // Open in external browser
      this.openExternalBrowser(authUrl);
    } catch (error) {
      this.logger.error('Failed to start authentication:', error);
      this.emit('AuthError', { error });
    }
  }

  private buildAuthUrl(): string {
    const params = new URLSearchParams({
      client_id: authConfig.clientId,
      response_type: 'code',
      scope: authConfig.scopes.join(' '),
      redirect_uri: authConfig.redirectUri,
      identity_provider: authConfig.identityProvider,
    });
    return `${authConfig.cognitoDomain}/oauth2/authorize?${params}`;
  }

  public async handleAuthCallback(callbackUrl: string): Promise<TokenSet | undefined> {
    try {
      const url = new URL(callbackUrl);
      const code = url.searchParams.get('code');

      if (!code) {
        throw new Error('[MCP] Missing authorization code');
      }

      // Exchange code for tokens
      const tokens = await this.exchangeCodeForTokens(code);

      // Get user info
      const userInfo = await this.fetchUserInfo(tokens.access_token);
      this.storeTokens(tokens);
      this.storeUserInfo(userInfo);
      this.logger.info('[MCP] User info:', redactInProd(userInfo));

      const provider = this.getCredentials();
      if (!provider) {
        throw new Error('Unable to get provider after login');
      }
      this.emit('LoginSuccess', { tokens, userInfo, provider });
      return tokens;
    } catch (error) {
      this.logger.error('[MCP] Auth callback handling failed:', error);
      this.emit('AuthError', { error });
    }
  }

  private async exchangeCodeForTokens(code: string): Promise<TokenSet> {
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: authConfig.clientId,
      code,
      redirect_uri: authConfig.redirectUri,
    });

    const response = await fetch(`${authConfig.cognitoDomain}/oauth2/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Token exchange failed: ${response.status} ${errorText}`);
    }

    const tokenData = await response.json();

    if (tokenData.error) {
      throw new Error(`Token error: ${tokenData.error}`);
    }

    return {
      ...tokenData,
      expires_at: Date.now() + tokenData.expires_in * 1000,
    };
  }

  private async fetchUserInfo(accessToken: string): Promise<UserInfo> {
    const response = await fetch(`${authConfig.cognitoDomain}/oauth2/userInfo`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch user info: ${response.status}`);
    }

    return response.json();
  }

  public async refresh(): Promise<void> {
    const tokens = this.getStoredTokens();

    if (!tokens?.refresh_token) {
      throw new Error('No refresh token available');
    }

    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: authConfig.clientId,
      refresh_token: tokens.refresh_token,
    });

    const response = await fetch(`${authConfig.cognitoDomain}/oauth2/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Token refresh failed: ${response.status} ${errorText}`);
    }

    const newTokenData = await response.json();

    if (newTokenData.error) {
      throw new Error(`Token refresh error: ${newTokenData.error}`);
    }

    const newTokens: TokenSet = {
      ...newTokenData,
      refresh_token: newTokenData.refresh_token || tokens.refresh_token,
      expires_at: Date.now() + newTokenData.expires_in * 1000,
    };

    this.storeTokens(newTokens);
  }

  public async getValidAccessToken(): Promise<string | null> {
    const tokens = this.getStoredTokens();

    if (!tokens) {
      return null;
    }

    // Check if token needs refresh (using configured threshold or 5 minute buffer as fallback)
    const refreshBuffer = Math.min(this.config.refreshThreshold, 300000); // 5 minutes max
    if (Date.now() + refreshBuffer >= tokens.expires_at) {
      try {
        await this.refresh();
        const refreshedTokens = this.getStoredTokens();
        return refreshedTokens?.access_token || null;
      } catch (error) {
        this.logger.error('Token refresh failed:', error);
        this.emit('AuthError', { error });
        return null;
      }
    }

    return tokens.access_token;
  }

  public getStoredTokens(): TokenSet | undefined {
    const tokensJson = localStorage.getItem(STORAGE_KEYS.tokens);
    return tokensJson ? JSON.parse(tokensJson) : undefined;
  }

  public getStoredUserInfo(): UserInfo | undefined {
    const userInfoJson = localStorage.getItem(STORAGE_KEYS.userInfo);
    return userInfoJson ? JSON.parse(userInfoJson) : undefined;
  }

  private storeTokens(tokens: TokenSet): void {
    localStorage.setItem(STORAGE_KEYS.tokens, JSON.stringify(tokens));
    this.authenticationState = 'authenticated';
  }

  private storeUserInfo(userInfo: UserInfo): void {
    localStorage.setItem(STORAGE_KEYS.userInfo, JSON.stringify(userInfo));
  }

  protected performLogoutCleanup(): void {
    // Clear local storage
    localStorage.removeItem(STORAGE_KEYS.tokens);
    localStorage.removeItem(STORAGE_KEYS.userInfo);

    // Optional: Open Cognito logout URL in external browser
    const logoutUrl = `${authConfig.cognitoDomain}/logout?client_id=${authConfig.clientId}&logout_uri=${authConfig.redirectUri}`;
    this.openExternalBrowser(logoutUrl);
  }

  // Debug/utility methods
  public getTokenExpiryInfo(): {
    expiresAt: number;
    timeUntilExpiry: number;
    shouldRefresh: boolean;
  } | null {
    const tokens = this.getStoredTokens();
    if (!tokens) return null;

    const timeUntilExpiry = tokens.expires_at - Date.now();
    return {
      expiresAt: tokens.expires_at,
      timeUntilExpiry,
      shouldRefresh: this.shouldRefreshToken(),
    };
  }

  public getCredentials(): CognitoIdentityCredentialProvider | undefined {
    const tokens = this.getStoredTokens();
    if (!tokens?.id_token) {
      return;
    }

    return fromCognitoIdentityPool({
      clientConfig: { region: authConfig.region },
      identityPoolId: authConfig.identityPoolId,
      logins: {
        [`cognito-idp.${authConfig.region}.amazonaws.com/${authConfig.usersPoolId}`]:
          tokens.id_token,
      },
    });
  }
}
