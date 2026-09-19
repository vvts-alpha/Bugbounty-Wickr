import { clsx } from 'clsx';
import React from 'react';

import { Svg, SvgProps } from '../../Svg';

import styles from './Spinner.module.less';

interface SpinnerProps extends SvgProps {
  width?: string | number;
  layout?: 'centerHorizontally' | 'centerVertically' | 'centerAll';
  playAnimation?: boolean;
}

export const SpinnerIcon: React.FC<SpinnerProps> = ({
  width,
  layout,
  className,
  playAnimation = true,
  ...rest
}) => (
  <div
    style={{ width }}
    className={clsx(className, styles.spinner, 'spinner-icon', {
      [styles.centerAll]: layout === 'centerAll',
      [styles.centerHorizontal]: layout === 'centerHorizontally',
      [styles.centerVertical]: layout === 'centerVertically',
    })}
    data-testid="spinner-icon"
  >
    <Svg
      role="progressbar"
      aria-busy={true}
      className={clsx({ [styles.paused]: !playAnimation })}
      {...rest}
    >
      <path
        d="M14.4688 11.75V11.7812C14.25 11.625 14.1562 11.3125 14.2812 11.0625C14.7188 10.1562 15 9.12497 15 7.99997C15 4.31247 12.125 1.28122 8.5 1.03122C8.21875 0.999969 8 0.781219 8 0.499969C8 0.249969 8.21875 -3.10261e-05 8.5 0.031219C12.6562 0.281219 16 3.74997 16 7.99997C16 9.28122 15.6875 10.5 15.1562 11.5625C15.0312 11.8125 14.7188 11.9062 14.4688 11.75Z"
        fill="currentColor"
      />
    </Svg>
  </div>
);
