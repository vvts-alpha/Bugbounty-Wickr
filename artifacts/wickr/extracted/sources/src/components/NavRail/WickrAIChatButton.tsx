import { clsx } from 'clsx';
import React from 'react';

import { AuthServiceType } from '../../lib/awsAuth/CompositeAuthService';
import { AwsAuthState } from '../../lib/awsAuth/types';

import styles from './WickrAIChatButton.module.less';

// The button will only be shown to dev and/or beta users

const WickrAIIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M9 10h.01" />
    <path d="M15 10h.01" />
    <path d="M12 2a8 8 0 0 0-8 8v12l3-3 2.5 2.5L12 19l2.5 2.5L17 19l3 3V10a8 8 0 0 0-8-8z" />
  </svg>
);

export const WickrKnowledgeBaseAIIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M12 2a8 8 0 0 0-8 8v12l3-3 2.5 2.5L12 19l2.5 2.5L17 19l3 3V10a8 8 0 0 0-8-8z" />
    <circle cx="9" cy="10" r="2" />
    <circle cx="15" cy="10" r="2" />
    <path d="M11 10h2" />
    <path d="M7 10 L5 9" />
    <path d="M17 10 L19 9" />
    <path d="M8 7.5 L10 8" />
    <path d="M14 8 L16 7.5" />
    <path d="M11 14 L12 13 L13 14 L12 15 Z" />
  </svg>
);

interface WickrAIChatButtonProps {
  authState: AwsAuthState;
  activeAuthService?: AuthServiceType;
  onLogin?: () => void;
  onChat?: () => void;
  className?: string;
}

export const WickrAIChatButton: React.FC<WickrAIChatButtonProps> = ({
  activeAuthService,
  authState,
  onLogin,
  onChat,
  className,
}) => {
  const handleClick = () => {
    switch (authState) {
      case 'unauthenticated':
        onLogin?.();
        break;
      case 'expired':
        onLogin?.();
        break;
      case 'authenticated':
        // When authenticated, open chat instead of account menu
        onChat?.();
        break;
    }
  };

  const getStateLabel = () => {
    switch (authState) {
      case 'unauthenticated':
        return 'Sign In';
      case 'expired':
        return 'Expired';
      case 'authenticated':
        return 'Chat';
    }
  };

  return (
    <button
      className={clsx(styles.wickrAIChatButton, styles[authState], className)}
      onClick={handleClick}
      type="button"
      title={getStateLabel()}
    >
      <div className={styles.content}>
        <WickrAIIcon className={styles.icon} />
        {getStateLabel() && <div className={styles.stateLabel}>{getStateLabel()}</div>}
        <div className={clsx(styles.statusBadge, styles[`badge-${authState}`])}></div>
      </div>
    </button>
  );
};

export default WickrAIChatButton;
