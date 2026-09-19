import React, { useContext, useEffect, useState, useCallback, useMemo, ReactNode } from 'react';
import { useWebChannel } from '@/apis/webChannel/context';
import useLatestCallback from '@/hooks/useLatestCallback';
import { useFeature } from '@/store/hooks/useFeature';
import {
  AwsAuthContext,
  AwsAuthContextValue,
  AwsAuthProviderState,
} from './AwsAuthProviderContext';
import { CompositeAuthService } from './CompositeAuthService';

interface AwsAuthProviderProps {
  children: ReactNode;
}

const DEFAULT_AUTH_CONTEXT_VALUE: AwsAuthContextValue = {
  isAuthenticated: false,
  login: async () => {},
  logout: async () => {},
  authState: 'unauthenticated',
};

/** AWS auth provider use by Wickr AI */
export const AwsAuthProvider: React.FC<AwsAuthProviderProps> = ({ children }) => {
  const webChannel = useWebChannel();
  const [providerState, setProviderState] = useState<AwsAuthProviderState>({
    authState: 'unauthenticated',
  });
  const wickrAIEnabled = useFeature('WickrAI');
  const authService = useMemo(() => {
    return wickrAIEnabled ? CompositeAuthService.getInstance(webChannel) : undefined;
  }, [wickrAIEnabled, webChannel]);

  // Helper function to convert AuthService state to provider state
  const getProviderStateFromService = (): AwsAuthProviderState => {
    if (!authService) {
      return {
        authState: 'unauthenticated',
      };
    }

    const authState = authService.getAuthState();
    const user = 'getStoredUserInfo' in authService ? authService.getStoredUserInfo() : undefined;
    const activeService =
      'getActiveServiceType' in authService ? authService.getActiveServiceType() : undefined;

    return {
      authState,
      user,
      error: authState === 'expired' ? 'Authentication expired' : undefined,
      activeService,
    };
  };

  const refreshProviderState = useLatestCallback(() => {
    setProviderState(getProviderStateFromService());
  });

  // Initialize auth service
  useEffect(() => {
    // Set initial auth state
    refreshProviderState();

    if (!authService) {
      return; // No cleanup needed if authService is null
    }

    // Register event listeners using Emitter pattern
    authService.on('TokenRefreshed', refreshProviderState);
    authService.on('AuthExpired', refreshProviderState);
    authService.on('LoginSuccess', refreshProviderState);
    authService.on('Logout', refreshProviderState);
    authService.on('AuthError', refreshProviderState);

    // Cleanup function
    return () => {
      if (authService) {
        authService.off('TokenRefreshed', refreshProviderState);
        authService.off('AuthExpired', refreshProviderState);
        authService.off('LoginSuccess', refreshProviderState);
        authService.off('Logout', refreshProviderState);
        authService.off('AuthError', refreshProviderState);
      }
    };
  }, [authService, refreshProviderState]);

  const login = useCallback(async () => {
    if (!authService) throw new Error('Auth service not initialized');

    setProviderState((prev) => ({ ...prev, error: undefined }));

    try {
      await authService.startAuthentication();
    } catch (error) {
      setProviderState((prev) => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Login failed',
      }));
      throw error;
    }
  }, [authService]);

  const logout = useCallback(() => {
    if (!authService) return;
    authService.logout();
  }, [authService]);

  const contextValue: AwsAuthContextValue = useMemo(
    () => ({
      ...providerState,
      isAuthenticated: providerState.authState === 'authenticated',
      login,
      logout,
      authService,
    }),
    [providerState, login, logout, authService]
  );

  return <AwsAuthContext.Provider value={contextValue}>{children}</AwsAuthContext.Provider>;
};

// Hook to use auth context
export const useAwsAuth = (): AwsAuthContextValue => {
  const context = useContext(AwsAuthContext);
  const wickrAIEnabled = useFeature('WickrAI');
  if (!wickrAIEnabled) {
    return DEFAULT_AUTH_CONTEXT_VALUE;
  }
  if (!context) {
    throw new Error('useAwsAuth must be used within an AwsAuthProvider');
  }
  return context;
};
