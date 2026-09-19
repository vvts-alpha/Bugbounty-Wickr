import { clsx } from 'clsx';
import React, { FC } from 'react';
import { Logger } from '@/lib/logger';

import styles from './Modal.module.less';

const logger = new Logger('ModalButtonGroup');

export interface ModalButtonGroupProps extends React.HTMLAttributes<HTMLDivElement> {}

export const ModalButtonGroup: FC<ModalButtonGroupProps> = ({ className, children }) => {
  return (
    <footer className={clsx(styles.btnGroup, className)} data-testid="modal-button-group">
      {children}
    </footer>
  );
};

export default ModalButtonGroup;
