import { ToolResultBlock, ToolUseBlock } from '@aws-sdk/client-bedrock-runtime';
import { clsx } from 'clsx';
import React, { useState } from 'react';

import { Button } from '../../../componentlibrary';
import { CautionIcon } from '../../../componentlibrary/icons/Caution';
import { SpinnerIcon } from '../../../componentlibrary/icons/Spinner';

import styles from './ToolCard.module.less';

interface ToolCardProps {
  toolCall: ToolUseBlock;
  toolResult?: ToolResultBlock;
  isExecuting?: boolean;
}

const ToolCard: React.FC<ToolCardProps> = ({ toolCall, toolResult, isExecuting }) => {
  const [showDetails, setShowDetails] = useState(false);

  const formatToolName = (name: string) => {
    return name
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const formatInputValue = (value: any): string => {
    if (typeof value === 'object') {
      return JSON.stringify(value, null, 2);
    }
    return String(value);
  };

  const getStatusIcon = () => {
    if (isExecuting) {
      return <SpinnerIcon width={16} height={16} className={styles.spinner} />;
    }
    if (toolResult?.status === 'error') {
      return <CautionIcon width={16} height={16} variant="error" />;
    }
    return <div className={styles.successIcon}>✓</div>;
  };

  const getStatusText = () => {
    if (isExecuting) {
      return 'Executing...';
    }
    if (toolResult?.status === 'error') {
      return 'Failed';
    }
    return 'Completed';
  };

  const getStatusClass = () => {
    if (isExecuting) {
      return styles.executing;
    }
    if (toolResult?.status === 'error') {
      return styles.error;
    }
    return styles.success;
  };

  return (
    <div className={clsx(styles.toolCard, getStatusClass())}>
      <div className={styles.toolHeader}>
        <div className={styles.toolInfo}>
          <div className={styles.toolName}>🛠️ {formatToolName(toolCall.name ?? '')}</div>
          <div className={styles.toolFooter}>
            <div className={styles.toolStatus}>
              {getStatusIcon()}
              <span className={styles.statusText}>{getStatusText()}</span>
            </div>
            <Button
              onClick={() => setShowDetails(!showDetails)}
              className={styles.detailsToggle}
              color="secondary"
            >
              +
            </Button>
          </div>
        </div>
      </div>

      {showDetails && toolCall.input && (
        <div className={styles.toolDetails}>
          {/* Tool Input */}
          {Object.keys(toolCall.input).length > 0 && (
            <div className={styles.section}>
              <div className={styles.sectionTitle}>Input:</div>
              <div className={styles.codeBlock}>
                {Object.entries(toolCall.input).map(([key, value]) => (
                  <div key={key} className={styles.inputItem}>
                    <span className={styles.inputKey}>{key}:</span>
                    <span className={styles.inputValue}>{formatInputValue(value)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tool Result */}
          {toolResult && (
            <div className={styles.section}>
              <div className={styles.sectionTitle}>
                {toolResult.status === 'error' ? 'Error:' : 'Result:'}
              </div>
              <div
                className={clsx(styles.codeBlock, {
                  [styles.errorResult]: toolResult.status === 'error',
                })}
              >
                <pre className={styles.resultContent}>
                  {JSON.stringify(toolResult.content, undefined, 2)}
                </pre>
              </div>
            </div>
          )}

          {/* Execution Info */}
          <div className={styles.executionInfo}>
            <span className={styles.toolId}>ID: {toolCall.toolUseId}</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default ToolCard;
