import { clsx } from 'clsx';
import React from 'react';
import { BaseProps } from '../Base';
import { PopOutIcon } from '../icons';

import styles from './ExternalLink.module.less';

export const DATASET_NOCONFIRM = 'noconfirm';

/** When applied to a link, we will never show the "are you sure?" prompt */
const DATA_ATTR_NO_CONFIRM = { [`data-${DATASET_NOCONFIRM}`]: 'true' };

interface ExternalLinkProps extends BaseProps, React.AnchorHTMLAttributes<HTMLAnchorElement> {
  showExternalLinkIcon?: boolean;
  title?: string;
  skipConfirmation?: boolean;
}

export const ExternalLink: React.FC<ExternalLinkProps> = ({
  className,
  rel = '',
  showExternalLinkIcon,
  skipConfirmation,
  children,
  title,
  ...otherProps
}) => {
  return (
    <a
      className={clsx(styles.externalLink, className)}
      {...DATA_ATTR_NO_CONFIRM}
      rel={`noopener noreferrer ${rel}`}
      target="_blank"
      title={title}
      {...otherProps}
    >
      {children}
      {showExternalLinkIcon && (
        <PopOutIcon width="1em" height="1em" className={styles.popoutIcon} />
      )}
    </a>
  );
};

export default ExternalLink;
