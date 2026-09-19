import { clsx } from 'clsx';
import { forwardRef, HTMLAttributes } from 'react';
import useForwardedRef from '@/hooks/useForwardedRef';

import styles from './styles.module.less';

interface ListProps extends HTMLAttributes<HTMLElement> {
  ordered?: boolean;
}

export const List = forwardRef<HTMLDivElement, ListProps>(
  ({ ordered = 'unordered', className, children, ...rest }, ref) => {
    const Tag = 'div'; // ordered ? 'ol' : 'ul'; TODO: Go back to using semantic elements when we move off Qt
    const forwardedRef = useForwardedRef(ref);
    return (
      <Tag className={clsx(styles.list, className)} {...rest} ref={forwardedRef}>
        {children}
      </Tag>
    );
  }
);
