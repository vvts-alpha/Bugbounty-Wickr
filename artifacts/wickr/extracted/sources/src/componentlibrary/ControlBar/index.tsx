import { FC, HTMLAttributes } from 'react';

import { BaseProps } from '../Base';
import { ControlBarContext } from './ControlBarContext';

import styles from './ControlBar.module.less';

export interface ControlBarProps extends HTMLAttributes<HTMLDivElement>, BaseProps {
  /** Whether or not the labels of the control bar items should show. */
  showLabels: boolean;
}

export const ControlBar: FC<ControlBarProps> = ({
  showLabels = false,
  className,
  children,
  ...rest
}) => {
  const controlBarContext = { showLabels };

  return (
    <ControlBarContext.Provider value={controlBarContext}>
      <nav className={styles.controlBar} data-testid="control-bar" {...rest}>
        {children}
      </nav>
    </ControlBarContext.Provider>
  );
};

export default ControlBar;
