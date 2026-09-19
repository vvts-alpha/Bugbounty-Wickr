import { clsx } from 'clsx';
import React, { forwardRef, ReactNode, Ref } from 'react';

import styles from './Input.module.less';

export interface InputWrapperProps {
  leadingIcon?: ReactNode;
  className?: string;
  children?: ReactNode | ReactNode[];
}

export const InputWrapper = forwardRef((props: InputWrapperProps, ref: Ref<HTMLSpanElement>) => {
  const { leadingIcon, className, children, ...rest } = props;
  const classes = clsx('ch-input-wrapper', className, styles.inputWrapper, {
    [styles.leadingIcon]: !!leadingIcon,
  });

  return (
    <span ref={ref} {...rest} className={classes} data-testid="input-wrapper">
      {leadingIcon && (
        <span className={styles.leadingIcon} aria-hidden>
          {leadingIcon}
        </span>
      )}
      {children}
    </span>
  );
});

export default InputWrapper;
