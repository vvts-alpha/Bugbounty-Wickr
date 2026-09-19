import { clsx } from 'clsx';
import React, { MouseEvent } from 'react';

import { Badge, IconButton } from '@/componentlibrary';
import useUniqueId from '@/hooks/useUniqueId';
import { HUNDRED_AND_MORE_BADGE_TEXT } from '@/utils/strings';

import styles from './styles.module.less';

interface NavRailButtonProps {
  label: string;
  icon: JSX.Element;
  className?: string;
  onClick?: (e: MouseEvent) => void;
  testId?: string;
  selected?: boolean;
  badgeCount?: number;
}

export const NavRailButton = React.forwardRef<HTMLDivElement, NavRailButtonProps>(
  ({ className, label, icon, onClick, testId = 'navRailButton', selected, badgeCount }, ref) => {
    const labelId = useUniqueId();

    const handleClick = (e: MouseEvent) => {
      e.preventDefault();
      onClick?.(e);
    };

    return (
      <div className={clsx(styles.navRailButton, className)} data-testid={testId} ref={ref}>
        <IconButton
          label={label}
          id={labelId}
          iconSize="md"
          selected={selected}
          className={clsx(styles.button, { [styles.selected]: selected })}
          onClick={handleClick}
          badge={
            !!badgeCount && (
              <Badge
                value={badgeCount > 99 ? HUNDRED_AND_MORE_BADGE_TEXT : badgeCount}
                className={styles.badge}
                aria-hidden
              />
            )
          }
        >
          {icon}
        </IconButton>
        <label className={styles.label} htmlFor={labelId}>
          {label}
        </label>
      </div>
    );
  }
);

export default NavRailButton;
