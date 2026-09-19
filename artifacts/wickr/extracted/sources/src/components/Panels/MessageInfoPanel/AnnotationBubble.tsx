import { HTMLAttributes, forwardRef } from 'react';

import styles from './AnnotationBubble.module.less';

export const AnnotationBubble = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ children }, ref) => {
    return (
      <div className={styles.annotationBubble} ref={ref}>
        {children}
      </div>
    );
  }
);

if (__DEV__) AnnotationBubble.displayName = 'AnnotationBubble';

export default AnnotationBubble;
