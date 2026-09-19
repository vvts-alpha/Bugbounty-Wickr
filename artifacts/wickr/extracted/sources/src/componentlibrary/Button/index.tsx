import { clsx } from 'clsx';
import React, { forwardRef, HTMLAttributes, useMemo } from 'react';
import { BaseProps } from '../Base';
import { SpinnerIcon } from '../icons';

import styles from './Button.module.less';

export type ButtonProps = HTMLAttributes<HTMLButtonElement> &
  BaseProps & {
    shape?: Shape;
    color?: Color;
    bordered?: boolean;
    selected?: boolean;
    disabled?: never;
    type?: ButtonType;
    testid?: string;
    isPending?: boolean;
    wrapperClassName?: string;
    label?: string;
    compact?: boolean;
  };

export type ButtonType = 'button' | 'submit' | 'reset';
type Shape = 'default' | 'rounded';
export type Color =
  | 'primary'
  | 'secondary'
  | 'transparent'
  | 'red'
  | 'green'
  | 'secondaryRed'
  | 'secondaryGreen'
  | 'secondaryBlue';

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      label,
      shape,
      color,
      bordered,
      compact,
      className,
      type = 'button',
      testid = 'button',
      isPending,
      children,
      wrapperClassName,
      ...rest
    }: ButtonProps,
    ref
  ) => {
    const buttonClasses = useMemo(
      () =>
        clsx(styles.baseBtn, className, {
          [styles.rounded]: shape === 'rounded',
          [styles.primary]: color === 'primary',
          [styles.secondary]: color === 'secondary',
          [styles.red]: color === 'red',
          [styles.green]: color === 'green',
          [styles.secondaryRed]: color === 'secondaryRed',
          [styles.secondaryGreen]: color === 'secondaryGreen',
          [styles.bordered]: bordered,
          [styles.compact]: compact,
        }),
      [className, bordered, shape, color, compact]
    );

    const handleClick = (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
      if (rest['aria-disabled']) {
        return;
      }
      rest?.onClick?.(e);
    };

    const handleClickCapture = (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
      if (rest['aria-disabled']) {
        e.preventDefault();
      }
    };

    return (
      <div className={clsx(styles.btnWrapper, wrapperClassName)}>
        <button
          className={buttonClasses}
          data-testid={testid}
          aria-label={label}
          type={type}
          {...rest}
          onClick={handleClick}
          ref={ref}
          onClickCapture={handleClickCapture}
        >
          {children}
          {isPending && (
            <SpinnerIcon
              className={styles.spinner}
            /> /* TODO figure out if buttons should show children & spinner */
          )}
        </button>
      </div>
    );
  }
);

export default Button;
