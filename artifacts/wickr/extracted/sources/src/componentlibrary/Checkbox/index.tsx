import { clsx } from 'clsx';
import React, { FC, ChangeEvent, useRef, ChangeEventHandler } from 'react';
import { CheckIcon, PartialCheckIcon } from '../icons';

import styles from './Checkbox.module.less';

export type CheckboxProps = React.InputHTMLAttributes<HTMLInputElement> & {
  /** Optional: The callback fired when the state is changed. */
  onChange?: ChangeEventHandler<HTMLInputElement>;
  /** Whether or not the to use the partial check icon. This is meant to show that the checkbox is in a intermediate check state (though it is still checked) For reference: https://css-tricks.com/indeterminate-checkboxes/*/
  showPartialCheckIcon?: boolean;
  disabled?: never;
  'aria-label': string;
};

export const Checkbox: FC<CheckboxProps> = ({
  checked,
  showPartialCheckIcon,
  onChange,
  className,
  ...rest
}: CheckboxProps) => {
  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (rest['aria-disabled']) return;
    onChange?.(e);
  };

  // TODO: Remove when screen readers can access <label> els in the QT WebView
  const hiddenInputRef = useRef<HTMLInputElement>(null);
  const handleClick = () => {
    hiddenInputRef.current?.click();
    hiddenInputRef.current?.focus();
  };

  return (
    <div
      className={clsx(styles.checkbox, className, {
        [styles.checked]: checked,
        [styles.disabled]: rest['aria-disabled'],
      })}
      onClick={handleClick}
    >
      {checked &&
        (showPartialCheckIcon ? (
          <PartialCheckIcon width="1.15em" aria-hidden />
        ) : (
          <CheckIcon variant="form" size="1em" data-testid="check" aria-hidden />
        ))}
      <input
        className={styles.hiddenInput}
        {...rest}
        type="checkbox"
        onChange={handleChange}
        checked={checked}
        ref={hiddenInputRef}
      />
    </div>
  );
};

export default Checkbox;
