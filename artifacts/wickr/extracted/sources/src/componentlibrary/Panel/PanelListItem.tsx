import { clsx } from 'clsx';
import { HTMLAttributes, forwardRef } from 'react';
import Button, { Color as ButtonColor } from '../Button';

import styles from './Panel.module.less';

interface PanelListItemProps extends HTMLAttributes<HTMLButtonElement> {
  itemClassName?: string;
  buttonClassName?: string;
  color?: ButtonColor;
}

export const PanelListItem = forwardRef<HTMLButtonElement, PanelListItemProps>(
  ({ children, itemClassName, buttonClassName, color, ...rest }, ref) => {
    // VoiceOver cannot read <li> tags in the QT WebEngine
    return (
      <div className={itemClassName}>
        <Button
          color={color}
          className={clsx(styles.panelListItemBtn, buttonClassName)}
          {...rest}
          ref={ref}
        >
          {children}
        </Button>
      </div>
    );
  }
);
