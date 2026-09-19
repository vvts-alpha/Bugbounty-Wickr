import { clsx } from 'clsx';
import React, { forwardRef } from 'react';

import styles from './Heading.module.less';

export type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export type HeadingProps = React.HTMLAttributes<HTMLHeadingElement> & {
  /** Indicates the styling of the heading. The level of heading from 1 to 6. 1 defines the most important heading, 6 defines the least important heading. */
  level: HeadingLevel;
  /** Indicates the HTML element of the component. */
  as?: keyof JSX.IntrinsicElements;
};

export const Heading = forwardRef<HTMLHeadingElement, HeadingProps>((props, ref) => {
  const { as, children, className, level, ...rest } = props;
  const HeadingEl = as || (`h${level}` as keyof JSX.IntrinsicElements);

  return (
    <HeadingEl
      className={clsx(className, styles.heading, styles[`level${level}`])}
      data-testid="heading"
      ref={ref}
      {...rest}
    >
      {children}
    </HeadingEl>
  );
});

export default Heading;
