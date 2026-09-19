import { clsx } from 'clsx';
import { FC, HTMLAttributes } from 'react';

import styles from './PopOver.module.less';

export interface PopOverSeparatorProps extends HTMLAttributes<HTMLDivElement> {}

export const PopOverSeparator: FC<PopOverSeparatorProps> = (props) => (
  <div
    role="none"
    data-testid="popover-separator"
    {...props}
    className={clsx(styles.popOverSeparator, props.className)}
  ></div>
);

export default PopOverSeparator;
