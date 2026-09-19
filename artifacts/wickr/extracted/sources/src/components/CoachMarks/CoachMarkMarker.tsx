import clsx from 'clsx';
import { forwardRef } from 'react';

import styles from './CoachMarks.module.less';

export type Props = Omit<React.HTMLAttributes<HTMLDivElement>, 'className'> & {
  theme?: 'light-theme' | 'dark-theme';
};

export const CoachMarkMarker = forwardRef<HTMLDivElement, Props>(({ theme, ...props }, ref) => {
  return (
    <div {...props} className={clsx(styles.marker, 'coach-mark-marker', theme)} ref={ref}>
      <div></div>
    </div>
  );
});
