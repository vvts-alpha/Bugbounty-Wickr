import { clsx } from 'clsx';
import { FC, InputHTMLAttributes, MouseEvent, useRef } from 'react';

import { BaseProps } from '../Base';

import styles from './Radio.module.less';

export interface RadioProps extends BaseProps, InputHTMLAttributes<HTMLInputElement> {
  /** The label of the radio. */
  label: string;
  /** Unique identifier to target element */
  testId?: string;
  /** Radiogroup name*/
  name?: string;
}

export const Radio: FC<RadioProps> = (props) => {
  const { value, checked, label, onChange, testId, className, children, ...rest } = props;
  const radioNode = useRef<HTMLInputElement>(null);

  const handleClick = (e: MouseEvent) => {
    e.stopPropagation();
    if (rest['disabled']) return;
    radioNode.current?.click(); // simulate click the native radio
    radioNode.current?.focus();
  };

  return (
    <div
      className={clsx(className, styles.radioLabel, {
        [styles.disabled]: props?.disabled,
      })}
      data-testid={testId}
      onClick={handleClick}
    >
      <input
        aria-label={label}
        className={styles.hiddenRadio}
        onChange={onChange}
        checked={checked}
        type="radio"
        value={value}
        ref={radioNode}
        data-testid="hidden-radio"
        {...rest}
      />
      <div
        className={clsx(styles.radioIcon, {
          [styles.checked]: checked,
        })}
      />
      <span className={styles.visibleLabel}>{children || label}</span>
    </div>
  );
};

if (__DEV__) Radio.displayName = 'Radio';

export default Radio;
