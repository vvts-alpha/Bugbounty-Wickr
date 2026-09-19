import { clsx } from 'clsx';
import isArray from 'lodash/isArray';
import React, { ChangeEvent, forwardRef } from 'react';
import { Tooltip } from '../';

import { ClearInputButton } from '../Input/ClearInputButton';
import Chip from './Chip';

import styles from './ChipInput.module.less';

export type ChipItem = {
  id: string;
  label: string;
  crossBoundary?: boolean;
};

interface ChipInputProps {
  selectedItems: (ChipItem | ChipItem[])[];
  placeholder?: string;
  inputValue: string;
  isDisabled?: boolean;
  onChange?: (searchQuery: string) => void;
  onRemoveItem?: (id: string) => void;
  onClearInput?: () => void;
  onKeydown?: (event: React.KeyboardEvent<HTMLInputElement>) => void;
  onMouseUp?: (e: React.MouseEvent) => void;
  onFocus?: (e: React.FocusEvent<HTMLInputElement>) => void;
  clearInputLabel?: string;
  testId?: string;
  className?: string;
  chipRemoveLabel?: string;
}

export const ChipInput = forwardRef<HTMLInputElement, ChipInputProps>(
  (
    {
      selectedItems,
      inputValue,
      placeholder,
      onChange,
      onRemoveItem,
      onClearInput,
      onKeydown,
      onMouseUp,
      onFocus,
      clearInputLabel,
      isDisabled,
      testId,
      className,
      chipRemoveLabel,
      ...rest
    },
    ref
  ) => {
    const handleChange = ({ target: { value } }: ChangeEvent<HTMLInputElement>) =>
      onChange?.(value);

    const inputIsNotEmpty = () => selectedItems?.length > 0 || inputValue.length > 0;

    return (
      <div className={clsx(styles.chipWrapper, className)}>
        <div className={styles.inputWrapper}>
          {selectedItems?.map((chip) => {
            const chipArray = isArray(chip) ? chip : [chip];
            const chipId = chipArray[0]?.id || '';
            return (
              <Chip
                key={chipId}
                removeLabel={chipRemoveLabel}
                value={chip}
                handleRemove={onRemoveItem}
              />
            );
          })}
          <input
            className={styles.chipInput}
            ref={ref}
            value={inputValue}
            onChange={handleChange}
            onKeyDown={onKeydown}
            onMouseUp={onMouseUp}
            onFocus={onFocus}
            placeholder={selectedItems?.length ? '' : placeholder}
            readOnly={isDisabled}
            data-testid={testId}
            {...rest}
          />
        </div>
        {onClearInput && clearInputLabel && inputIsNotEmpty() && (
          <Tooltip tip={clearInputLabel}>
            <ClearInputButton onClick={onClearInput} aria-label={clearInputLabel} />
          </Tooltip>
        )}
      </div>
    );
  }
);

export default ChipInput;
