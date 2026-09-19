import { clsx } from 'clsx';
import React, { FC, HTMLAttributes } from 'react';

import { BaseProps } from '../Base';

import styles from './Modal.module.less';

interface ModalBodyProps extends HTMLAttributes<HTMLDivElement>, BaseProps {}

export const ModalBody: FC<ModalBodyProps> = ({ children, className, ...rest }) => {
  return (
    <div data-testid="modal-body" {...rest} className={clsx(styles.modalBody, className)}>
      {children}
    </div>
  );
};

export default ModalBody;
