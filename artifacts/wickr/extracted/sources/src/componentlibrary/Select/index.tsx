import { clsx } from 'clsx';
import { ChangeEvent, forwardRef, Ref, InputHTMLAttributes } from 'react';

import styles from './Select.module.less';

export type SelectOption = {
  value: string | number;
  label: string;
  disabled?: boolean;
};

export interface SelectProps extends InputHTMLAttributes<HTMLSelectElement> {
  /** Options */
  options: SelectOption[];
  /** The callback fired when the option is changed. */
  onChange(event: ChangeEvent): void;
  /** The selected option */
  value: SelectOption['value'];
  /** Additional Options */
  additionalOptions?: SelectOption[];
}

const renderOptions = (options: SelectOption[]) => {
  return options.map(({ value, label, disabled }, i) => (
    <option key={value} value={value} disabled={disabled} data-testid={`select-${i}`}>
      {label}
    </option>
  ));
};

export const Select = forwardRef((props: SelectProps, ref: Ref<HTMLSelectElement>) => {
  const { className, options, additionalOptions = [], ...rest } = props;
  return (
    <div className={clsx(styles.wrapper, className)}>
      <select className={styles.select} data-testid="select" ref={ref} {...rest}>
        {renderOptions(options)}
        {additionalOptions.length > 0 && (
          <>
            <option disabled>────────────────────</option>
            {renderOptions(additionalOptions)}
          </>
        )}
      </select>
    </div>
  );
});

if (__DEV__) Select.displayName = 'Select';

export default Select;
