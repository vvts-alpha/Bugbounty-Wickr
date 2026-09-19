import { clsx } from 'clsx';
import React from 'react';
import { Svg, SvgProps } from '../../Svg';

import styles from './ProgressCircle.module.less';

export interface ProgressCircleProps extends SvgProps {
  /** Percentage of progress between 0-100 */
  percentage: number;
  isInProgress: boolean;
  strokeWidth?: number;
}

export const ProgressCircleIcon: React.FC<ProgressCircleProps> = ({
  percentage,
  isInProgress,
  className,
  strokeWidth = 1,
  ...rest
}) => {
  const radius = 8 - strokeWidth;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * ((100 - percentage) / 100);
  const circleProps: SvgProps = {
    cx: radius + strokeWidth,
    cy: radius + strokeWidth,
    fill: 'transparent',
  };
  return (
    <Svg className={clsx(styles.progressCircle, className)} {...rest}>
      <circle
        className={percentage > 0 ? styles.ringBackground : styles.emptyRingBackground}
        {...circleProps}
        r={radius}
        stroke="currentColor"
        strokeWidth={strokeWidth}
      />
      <circle
        className={styles.ring}
        {...circleProps}
        r={radius}
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeDasharray={circumference}
        strokeDashoffset={dashOffset}
      />
      {isInProgress ? (
        <path
          className={styles.button}
          d="M7 5.75V10.25C7 10.6875 6.65625 11 6.25 11C5.8125 11 5.5 10.6875 5.5 10.25V5.75C5.5 5.34375 5.8125 5 6.25 5C6.65625 5 7 5.34375 7 5.75ZM10.5 5.75V10.25C10.5 10.6875 10.1562 11 9.75 11C9.3125 11 9 10.6875 9 10.25V5.75C9 5.34375 9.3125 5 9.75 5C10.1562 5 10.5 5.34375 10.5 5.75Z"
          fill="currentColor"
        />
      ) : (
        <path
          className={styles.button}
          d="M6.64062 4.625L11.1406 7.375C11.3594 7.5 11.5156 7.75 11.5156 8C11.5156 8.28125 11.3594 8.5 11.1406 8.65625L6.64062 11.4062C6.42188 11.5312 6.10938 11.5625 5.89062 11.4062C5.64062 11.2812 5.48438 11.0312 5.48438 10.75V5.25C5.48438 5 5.64062 4.75 5.89062 4.59375C6.10938 4.46875 6.42188 4.46875 6.64062 4.625Z"
          fill="currentColor"
        />
      )}
    </Svg>
  );
};
