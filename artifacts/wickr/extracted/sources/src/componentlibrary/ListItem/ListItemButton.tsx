import React from 'react';

import { BaseProps } from '../Base';

import styles from './ListItem.module.less';

export interface ListItemButtonProps extends BaseProps {
  onClick?: ((event: React.MouseEvent) => void) | (() => void);
  ariaLabel?: string;
  testId?: string;
  className?: string;
}

export const ListItemButton: ReactFC<ListItemButtonProps> = ({
  onClick,
  ariaLabel,
  className,
  testId,
  children,
}) => {
  // VoiceOver cannot read <li> tags in the QT WebEngine
  return (
    <div className={className}>
      <button
        className={styles.mainContent}
        onClick={onClick}
        aria-label={ariaLabel}
        data-testid={testId}
      >
        {children}
      </button>
    </div>
  );
};

export default ListItemButton;
