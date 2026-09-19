import { clsx } from 'clsx';
import { FC, HTMLAttributes } from 'react';

import { BaseProps } from '../Base';

import styles from './Panel.module.less';

interface PanelBodyProps extends HTMLAttributes<HTMLDivElement>, BaseProps {}

export const PanelBody: FC<PanelBodyProps> = ({ children, className, ...rest }) => {
  return (
    <div data-testid="panel-body" {...rest} className={clsx(styles.panelBody, className)}>
      {children}
    </div>
  );
};

export default PanelBody;
