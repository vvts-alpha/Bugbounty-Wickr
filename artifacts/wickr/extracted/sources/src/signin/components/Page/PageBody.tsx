import { clsx } from 'clsx';
import { HTMLAttributes } from 'react';
import { BaseProps } from '@/componentlibrary/Base';
import styles from './styles.module.less';

interface PageBodyProps extends HTMLAttributes<HTMLDivElement>, BaseProps {}

const PageBody: ReactFC<PageBodyProps> = ({ children, className, ...rest }) => {
  return (
    <div {...rest} className={clsx(styles.pageBody, className)}>
      {children}
    </div>
  );
};

export default PageBody;
