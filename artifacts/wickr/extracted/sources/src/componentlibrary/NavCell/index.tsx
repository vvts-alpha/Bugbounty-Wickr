import { clsx } from 'clsx';
import { useRef, MouseEvent } from 'react';
import { NavLink } from 'react-router-dom';

import { Badge } from '../Badge';
import styles from './NavCell.module.less';

type NavCellProps = {
  label: string;
  linkTo?: string;
  unread?: boolean;
  unreadBadgeLabel?: string;
  onClick?: (e: MouseEvent) => void;
  testId?: string;
  selected?: boolean;
  badgeAriaLabel?: string;
  className?: string;
};

export const NavCell: ReactFC<NavCellProps> = ({
  label,
  children,
  onClick,
  unread,
  unreadBadgeLabel,
  linkTo = '',
  className,
  testId = 'navCell',
  selected,
  badgeAriaLabel,
}) => {
  const actionButton = useRef<HTMLButtonElement | null>(null);

  const handleClick = (e: MouseEvent) => {
    if (!linkTo) e.preventDefault();
    onClick?.(e);
  };

  const handleContextMenu = (e: MouseEvent) => {
    e.preventDefault();
    actionButton.current?.click();
  };

  const displayUnreadBadge = unread && unreadBadgeLabel;

  const classNames = clsx(styles.navCell, className, {
    [styles.selected]: selected,
  });

  return (
    <NavLink
      className={classNames}
      onClick={handleClick}
      to={linkTo}
      onContextMenu={handleContextMenu}
      data-testid={testId}
    >
      {children || label}
      {displayUnreadBadge && (
        <Badge
          value={unreadBadgeLabel}
          className={styles.unreadBadge}
          status="info"
          aria-hidden
          aria-label={badgeAriaLabel}
        />
      )}
    </NavLink>
  );
};

export default NavCell;
