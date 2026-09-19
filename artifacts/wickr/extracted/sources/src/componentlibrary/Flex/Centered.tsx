import clsx from 'clsx';
import styles from './styles.module.less';

export const FlexCentered: ReactFC<{ className?: string }> = ({ children, className }) => (
  <div className={clsx(styles.flexCentered, className)}>{children}</div>
);
