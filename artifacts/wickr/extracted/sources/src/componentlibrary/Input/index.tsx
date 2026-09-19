import { clsx } from 'clsx';
import React, { ChangeEvent, ReactNode, forwardRef, Ref, useRef } from 'react';
import { BaseProps } from '../Base';
import { ClearInputButton } from '../Input/ClearInputButton';
import { SpinnerIcon } from '../icons';
import useEventListener from '@/hooks/useEventListener';
import useForwardedRef from '@/hooks/useForwardedRef';
import InputWrapper from './InputWrapper';

export type Size = 'sm' | 'md';

import styles from './Input.module.less';

export interface InputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value' | 'css'>,
    BaseProps {
  /** The callback fired when the state is changed. */
  onChange(event: ChangeEvent<HTMLInputElement>): void;
  /** The callback fired when the input value is cleared. */
  onClear?(): void;
  /** The icon in the input. */
  leadingIcon?: ReactNode;
  /** The value of the input. */
  value: string;
  /** The id of the input. */
  id?: string;
  /** Whether spinner should be shown in place of clear button. */
  isLoading?: boolean;
  /** Whether or not the clear icon is shown, it defaults to `true`. */
  showClear?: boolean;
  /** test id */
  'data-testid'?: string;
  /** The trailing icon in the input. */
  trailingContent?: ReactJSXChild;
}

export const Input = forwardRef((props: InputProps, ref: Ref<HTMLInputElement>) => {
  const {
    type,
    value,
    isLoading = false,
    onClear,
    onChange,
    onFocus,
    className,
    leadingIcon,
    showClear = true,
    trailingContent,
    ...rest
  } = props;
  const focusedRef = useRef(false);
  const inputRef = useForwardedRef(ref);
  const clearRef = useRef<HTMLButtonElement>(null);
  const renderClear = showClear && value.length !== 0;

  const label = props['aria-label'] ? `clear ${props['aria-label']}` : 'clear';

  const handleClear = () => {
    if (onClear) {
      onClear();
      return;
    }

    const input = inputRef.current;
    const nativeSetter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      'value'
    )?.set;

    if (nativeSetter && input) {
      nativeSetter.call(input, '');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }

    input.focus();
  };

  // Track document focus to blur the styling when document is out of focus
  const blurringRef = useRef(false);
  useEventListener(document, 'focusin', (e) => {
    if (!focusedRef.current) {
      return;
    }

    if (e.target !== clearRef.current && e.target !== inputRef.current) {
      focusedRef.current = false;
      return;
    }

    if (blurringRef.current) {
      blurringRef.current = false;
    }
  });

  useEventListener(document, 'focusout', () => {
    if (!focusedRef.current) {
      return;
    }

    blurringRef.current = true;
    setTimeout(() => {
      if (blurringRef.current) {
        focusedRef.current = false;
      }

      blurringRef.current = false;
    }, 10);
  });

  return (
    <InputWrapper leadingIcon={leadingIcon} className={className}>
      <input
        {...rest}
        value={value}
        type={type || 'text'}
        ref={inputRef}
        className={clsx('ch-input', styles.input)}
        onChange={onChange}
        data-testid={rest['data-testid'] || 'input'}
        onFocus={(e) => {
          props.onFocus && props.onFocus(e);
          focusedRef.current = true;
        }}
      />
      <div className={styles.endIconContainer}>
        {isLoading && <SpinnerIcon width="1.25rem" />}
        {renderClear && (
          <ClearInputButton
            className={clsx('inputClearButton')}
            tabIndex={0}
            aria-label={label}
            onClick={handleClear}
            ref={clearRef}
          />
        )}
        {trailingContent}
      </div>
    </InputWrapper>
  );
});

if (__DEV__) Input.displayName = 'Input';

export default Input;
