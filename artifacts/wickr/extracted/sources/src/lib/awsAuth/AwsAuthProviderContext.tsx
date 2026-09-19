import { createContext } from 'react';
import { BaseAuthService } from './BaseAuthService';
import { AuthServiceType } from './CompositeAuthService';
import { AwsAuthState, UserInfo } from './types';

export interface AwsAuthProviderState {
  authState: AwsAuthState;
  user?: UserInfo;
  error?: string;
  activeService?: AuthServiceType;
}

export interface AwsAuthContextValue extends AwsAuthProviderState {
  isAuthenticated: boolean;
  login: () => Promise<void>;
  logout: () => void;
  authService?: BaseAuthService;
}

export const AwsAuthContext = createContext<AwsAuthContextValue | null>(null);
