import { clsx } from 'clsx';
import React, { forwardRef, HTMLAttributes } from 'react';

import { BaseProps } from '../Base';
import { ClearInputIcon } from '../icons';

import styles from './ClearInputButton.module.less';

export interface ClearInputButtonProps extends HTMLAttributes<HTMLButtonElement>, BaseProps {
  tabIndex?: number;
}

export const ClearInputButton = forwardRef<HTMLButtonElement, ClearInputButtonProps>(
  ({ className, ...rest }, ref) => {
    return (
      <button type="button" className={clsx(styles.clearButton, className)} ref={ref} {...rest}>
        <ClearInputIcon />
      </button>
    );
  }
);
