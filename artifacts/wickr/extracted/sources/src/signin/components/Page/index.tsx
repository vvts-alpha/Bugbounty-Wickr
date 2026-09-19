import { clsx } from 'clsx';
import { HTMLAttributes } from 'react';
import { BaseProps } from '@/componentlibrary/Base';
import styles from './styles.module.less';

interface PageProps extends HTMLAttributes<HTMLDivElement>, BaseProps {}

const Page: ReactFC<PageProps> = ({ children, className, ...rest }) => {
  return (
    <div {...rest} className={clsx(styles.page, className)}>
      {children}
    </div>
  );
};

export default Page;
