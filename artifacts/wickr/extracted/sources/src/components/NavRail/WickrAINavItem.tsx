import React from 'react';

import { useAwsAuth } from '@/lib/awsAuth/AwsAuthProvider';
import { useAppDispatch } from '@/store';
import { pushPanel } from '@/store/slices/panels';

import WickrAIChatButton from './WickrAIChatButton';

const WickrAINavItem: React.FC = () => {
  const { authState, login, activeService } = useAwsAuth();
  const dispatch = useAppDispatch();

  // Transform auth state
  // Treat AWS 'authenticated' as 'expired', so clicking on the button will tigger Cognito auth flow
  const effectiveAuthState =
    activeService === 'aws' && authState === 'authenticated' ? 'expired' : authState;

  return (
    <WickrAIChatButton
      activeAuthService={activeService}
      authState={effectiveAuthState}
      onLogin={() => login()}
      onChat={() => dispatch(pushPanel({ name: 'WickrAIChatPanel' }))}
    />
  );
};

export default WickrAINavItem;
