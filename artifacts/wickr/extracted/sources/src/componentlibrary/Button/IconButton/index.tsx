import { clsx } from 'clsx';
import React, { forwardRef } from 'react';

import Button, { ButtonProps } from '..';

import styles from './styles.module.less';

type IconSize = 'sm' | 'md' | 'lg';

export type IconButtonProps = Omit<ButtonProps, 'shape'> & {
  label: string;
  /** Render a component to the top right area of the IconButton */
  badge?: React.ReactNode | React.ReactNode[];
  secondaryBadge?: React.ReactNode;
  testid?: string;
  badgeWrapperClassName?: string;
  iconSize?: IconSize;
};

export const IconButton = forwardRef(
  (
    {
      className,
      badgeWrapperClassName,
      badge,
      secondaryBadge,
      iconSize = 'sm',
      children,
      ...props
    }: IconButtonProps,
    ref: React.Ref<HTMLButtonElement>
  ) => {
    const buttonClasses = clsx(styles.iconButton, className, {
      [styles.iconSelected]: props.selected,
      [styles.smBtn]: iconSize === 'sm',
      [styles.mdBtn]: iconSize === 'md',
      [styles.lgBtn]: iconSize === 'lg',
    });

    return (
      <Button className={buttonClasses} ref={ref} {...props}>
        {children}
        {!!badge && <span className={clsx(styles.badge, badgeWrapperClassName)}>{badge}</span>}
        {!!secondaryBadge && <span className={styles.secondaryBadge}>{secondaryBadge}</span>}
      </Button>
    );
  }
);

export default IconButton;
