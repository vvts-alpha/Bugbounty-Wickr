import { clsx } from 'clsx';
import { FC, InputHTMLAttributes } from 'react';
import { Button, CaretIcon, PopOver, PopOverItem, ScreenReaderContent } from '..';
import { useAppTranslation } from '@/lib/i18n';
import { SelectOption } from '.';

import styles from './Select.module.less';

type Props = Omit<InputHTMLAttributes<HTMLSelectElement>, 'onChange'> & {
  label?: string;
  options: SelectOption[];
  selectedOption: SelectOption | SelectOption[];
  onChange: (value: SelectOption['value']) => void;
  offset?: [number, number];
  menuClassName?: string;
};

const AccessibleSelect: FC<Props> = ({
  label,
  options,
  selectedOption,
  onChange,
  offset,
  className,
  menuClassName,
}) => {
  // We typically do not want to have dependencies like AppTranslation in
  // the component library. But this component is a temporary workaround until we
  // upgrade to Electron and we can use a11y best practices again
  const { t } = useAppTranslation();

  const items = options.map((option) => {
    return Array.isArray(selectedOption) ? (
      <PopOverItem
        listItemClassName={styles.item}
        key={option.value}
        onClick={() => onChange(option.value)}
        checked={!!selectedOption.find((opt) => opt.value === option.value)}
        disabled={option.disabled}
      >
        {option.label}
        {!!selectedOption.find((opt) => opt.value === option.value) && (
          <ScreenReaderContent>{t('checked')}</ScreenReaderContent>
        )}
      </PopOverItem>
    ) : (
      <PopOverItem
        listItemClassName={styles.item}
        key={option.value}
        onClick={() => onChange(option.value)}
        checked={option.value === selectedOption.value}
        disabled={option.disabled}
      >
        {option.label}
        {option.value === selectedOption.value && (
          <ScreenReaderContent>{t('checked')}</ScreenReaderContent>
        )}
      </PopOverItem>
    );
  });

  return (
    <PopOver
      contentWrapperClassName={clsx(styles.wrapper, className)}
      menuClassName={clsx(styles.menu, menuClassName)}
      popoverContent={items}
      offset={offset}
      triggerType="click"
      menuDescription={`${label} accessible select options`}
    >
      {label && <div className={styles.label}>{label}</div>}
      <Button className={styles.btn} aria-description={`${label} accessible select`}>
        {Array.isArray(selectedOption)
          ? t('OptionSelected', { count: selectedOption.length })
          : selectedOption.label}
        <CaretIcon direction="down" />
      </Button>
    </PopOver>
  );
};

export default AccessibleSelect;
