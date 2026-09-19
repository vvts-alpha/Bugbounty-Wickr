import { clsx } from 'clsx';
import { FC, JSX, useRef } from 'react';

import styles from './styles.module.less';

type ToggleProps = JSX.IntrinsicElements['input'] & {
  /** Use `aria-disabled` instead */
  disabled?: never;
  /** The label for the toggle, which can be hidden with `hideLabel` to function like an aria-label */
  label: string;
  /** Default: true. This prop allows the content provided by the label prop to be visually hidden and function like an aria-label */
  hideLabel?: boolean;
};

export const Toggle: FC<ToggleProps> = ({ onChange, label, hideLabel = true, ...props }) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (props['aria-disabled']) return;
    onChange?.(e);
  };

  // TODO: Remove when screen readers can access <label> els in the QT WebView
  const hiddenInputRef = useRef<HTMLInputElement>(null);
  const handleClick = () => {
    if (props['aria-disabled']) return;
    hiddenInputRef.current?.click();
    hiddenInputRef.current?.focus();
  };

  return (
    <div className={clsx(styles.container, props.className)} onClick={handleClick}>
      <p className={clsx(styles.label, { [styles.hideLabel]: hideLabel })} aria-hidden={hideLabel}>
        {label}
      </p>
      <span className={styles.toggle}>
        <input
          {...props}
          onChange={handleChange}
          type="checkbox"
          className={styles.hiddenInput}
          aria-label={label}
          ref={hiddenInputRef}
        />
        <div
          className={clsx(styles.pill, {
            [styles.on]: props.checked,
            [styles.disabled]: props['aria-disabled'],
          })}
        >
          <div className={styles.dot}></div>
        </div>
      </span>
    </div>
  );
};
