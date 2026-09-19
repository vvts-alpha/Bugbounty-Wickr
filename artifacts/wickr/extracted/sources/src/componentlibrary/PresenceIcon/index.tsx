import React from 'react';
import { AvailableIcon, StatusIcon } from '../icons';
import { StatusIconFilledAmount } from '../icons/Status';
import styles from './PresenceIcon.module.less';

interface PresenceIconProps {
  timeIdle: number;
}

export const PresenceIcon: React.FC<PresenceIconProps> = ({ timeIdle }) => {
  const getStatusIconFilledAmount = (): StatusIconFilledAmount => {
    if (timeIdle < 900) {
      return 'full';
    } else if (timeIdle < 1800) {
      return 'three-quarters';
    } else if (timeIdle < 2700) {
      return 'half';
    } else if (timeIdle < 3600) {
      return 'one-quarter';
    }

    return 'empty';
  };

  if (getStatusIconFilledAmount() === 'full') {
    return (
      <div className={styles.presence}>
        <AvailableIcon height="1em" width="1em" />
      </div>
    );
  }

  return (
    <div className={styles.presence}>
      <StatusIcon size="1em" filledAmount={getStatusIconFilledAmount()} />
    </div>
  );
};
