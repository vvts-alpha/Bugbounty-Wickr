import { clsx } from 'clsx';

import { BaseProps } from '../Base';

import styles from './Paragraph.module.less';

export const Paragraph: ReactFC<BaseProps> = ({ children, className, ...rest }) => (
  <p className={clsx(styles.paragraph, className)} data-testid="paragraph" {...rest}>
    {children}
  </p>
);

export default Paragraph;
