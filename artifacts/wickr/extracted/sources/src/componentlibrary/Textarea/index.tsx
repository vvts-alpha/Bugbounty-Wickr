import { clsx } from 'clsx';
import React, { ChangeEvent, InputHTMLAttributes, Ref } from 'react';

import styles from './Textarea.module.less';

export interface TextareaProps
  extends Omit<InputHTMLAttributes<HTMLTextAreaElement>, 'onChange' | 'value'> {
  /** The callback fired when the text is changed. */
  onChange?: (event: ChangeEvent) => void;
  /** The value of the textarea. */
  value: string;
  /** The label for availability. */
  label?: string;
  /** Number of rows on textarea. */
  rows?: number;
}

export const Textarea = React.forwardRef(
  ({ label, className, ...props }: TextareaProps, ref: Ref<HTMLTextAreaElement>) => {
    return (
      <textarea
        className={clsx(styles.textArea, className)}
        data-testid="textarea"
        aria-label={label}
        ref={ref}
        {...props}
      />
    );
  }
);

if (__DEV__) Textarea.displayName = 'Textarea';

export default Textarea;
