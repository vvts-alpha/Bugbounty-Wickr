import { clsx } from 'clsx';
import { HTMLAttributes } from 'react';

import styles from './ListItem.module.less';

export interface ListItemProps extends HTMLAttributes<HTMLDivElement> {
  ariaLabel?: string;
  testId?: string;
  className?: string;
}

export const ListItem: ReactFC<ListItemProps> = ({ children, className, ...rest }) => {
  // VoiceOver cannot read <li> tags in the QT WebEngine
  return (
    <div className={clsx(styles.mainContent, className)} {...rest}>
      {children}
    </div>
  );
};

export default ListItem;
