import { clsx } from 'clsx';
import React, { FC, ReactNode, HTMLAttributes } from 'react';

import styles from './ScreenReaderContent.module.less';

interface ScreenReaderContentProps extends HTMLAttributes<HTMLSpanElement> {
  children: ReactNode | string;
  role?: string;
  copyable?: boolean; // Used in junction w/ CopyHandler.tsx selector
  className?: string;
}

export const ScreenReaderContent: FC<ScreenReaderContentProps> = ({
  children,
  copyable,
  className,
  ...rest
}) => (
  <span
    {...rest}
    className={clsx(styles.visuallyHidden, className, {
      notCopyable: !copyable,
    })}
  >
    {children}
  </span>
);

export default ScreenReaderContent;
