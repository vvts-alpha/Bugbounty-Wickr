import { clsx } from 'clsx';
import React, { FC, HTMLAttributes } from 'react';

import { BaseProps } from '../Base';
import { ScreenReaderContent } from './../ScreenReaderContent';

import styles from './Badge.module.less';

export interface BadgeProps extends BaseProps {
  /** The value shows in the badge*/
  value: string | number | JSX.Element;
  /** The status of the badge */
  status?: 'default' | 'alert' | 'info' | 'success';
  /** additional className */
  className?: string;
}

export const Badge: FC<BadgeProps> = ({ value, status = 'default', className, ...props }) => {
  return (
    <>
      <span
        className={clsx(
          styles.badge,
          {
            [styles.alert]: status === 'alert',
            [styles.info]: status === 'info',
            [styles.success]: status === 'success',
            [styles.element]: typeof value === 'object',
          },
          className
        )}
        data-testid="badge"
        aria-hidden
        {...props}
      >
        {value}
      </span>
      <ScreenReaderContent>
        {(props as HTMLAttributes<any>)['aria-label'] || value}
      </ScreenReaderContent>
    </>
  );
};

export default Badge;
