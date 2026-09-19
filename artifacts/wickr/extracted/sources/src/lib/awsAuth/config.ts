import { AuthConfig } from './types';
// AWS cognito auth endpoints for DEV and/or Beta users
// with this endpoint we can test bedrock models with PROD rate limit
export const authConfig: AuthConfig = {
  cognitoDomain: 'https://us-west-22aikmatoy.auth.us-west-2.amazoncognito.com',
  clientId: '5du05u6952kog165c0rhr608l6',
  redirectUri: 'wickrprobeta://bedrock-auth/info',
  scopes: ['openid'],
  identityProvider: 'Federate',
  region: 'us-west-2',
  identityPoolId: 'us-west-2:221d6549-f7b3-4a08-88f7-863587c7be1f',
  usersPoolId: 'us-west-2_2AIKmAToY',
};
export const STORAGE_KEYS = {
  tokens: 'oidc_tokens',
  userInfo: 'oidc_user_info',
  pkceParams: 'oidc_pkce_params',
} as const;
