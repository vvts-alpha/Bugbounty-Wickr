import { clsx } from 'clsx';
import { HTMLAttributes } from 'react';
import { BaseProps } from '@/componentlibrary/Base';
import styles from '../styles.module.less';

interface PageHeaderProps extends HTMLAttributes<HTMLDivElement>, BaseProps {}

const PageHeader: ReactFC<PageHeaderProps> = ({ children, className, ...rest }) => {
  // TODO: Add "URL input" PageHeader
  return (
    <header {...rest} className={clsx(styles.pageHeader, className)}>
      {children}
    </header>
  );
};

export default PageHeader;
