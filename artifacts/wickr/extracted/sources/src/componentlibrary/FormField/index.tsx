import { clsx } from 'clsx';
import React, { forwardRef, Ref, ChangeEvent, useEffect, useRef, ReactNode } from 'react';

import { BaseProps } from '../Base';
import Checkbox from '../Checkbox';
import Input from '../Input';
import Radio from '../Radio';
import RadioGroup from '../RadioGroup';
import ScreenReaderContent from '../ScreenReaderContent';
import Select from '../Select';
import Textarea from '../Textarea';
import Tooltip from '../Tooltip';
import useDebouncedCallback from '@/hooks/useDebouncedCallback';
import useStateSafely from '@/hooks/useStateSafely';
import useUniqueId from '@/hooks/useUniqueId';

import './FormField.less';

const componentMap = {
  input: Input,
  select: Select,
  textarea: Textarea,
  checkbox: Checkbox,
  radiogroup: RadioGroup,
  radio: Radio,
} as const;

export type FieldName = keyof typeof componentMap;

type ElementType = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

export interface FieldProps {
  /** The callback fired when the state is changed. */
  onChange(event: ChangeEvent<ElementType>): void;
  /** The label of the field. */
  label: string;
  /** The name of the field component. */
  fieldName: FieldName;
  /** The informational text in the field. */
  infoContent?: string | React.ReactElement;
  /** Whether or not the error text is shown. */
  hasError?: boolean;
  /** The error text in the field. */
  errorContent?: string | React.ReactElement;
  /** Additional props for field component. */
  fieldProps?: any;
  /** The value of the field. */
  value?: string;
  /** Whether or not the field is checked. */
  checked?: boolean;
  /** Options for some fields, e.g. radio group or select. */
  options?: string[] | object[];
  /** Maxlength of the input text. */
  maxLength?: number;
  /** Tooltip content */
  tip?: ReactNode;
}

export interface LayoutProps {
  /** Specify the layout of the field, it defaults to `stack`. */
  layout?: 'stack' | 'horizontal' | 'input-only';
  error?: boolean;
}

export interface FormFieldProps extends FieldProps, LayoutProps, BaseProps {}
export interface FieldWrapperProps extends BaseProps, LayoutProps {}

const WINDOWS_INPUT_MAX_CHAR_ALERT_DELAY = 2000;

export const FormField = forwardRef((props: FormFieldProps, ref: Ref<HTMLElement>) => {
  const {
    fieldName,
    label,
    layout = 'stack',
    errorContent,
    fieldProps,
    infoContent,
    hasError,
    onChange,
    value,
    checked,
    options,
    className,
    maxLength,
    tip,
    ...rest
  } = props;

  const Field = componentMap[fieldName];
  const labelId = useUniqueId();
  const descriptionId = useUniqueId();
  const helpText = (hasError && errorContent) || infoContent;
  // was getting some app hangs while testing locally.
  // This ensures we don't accidentally set state on an unmounted component.
  const [windowsAlert, setWindowsAlert] = useStateSafely<string | React.ReactElement>('');

  /**
   * This function is a work around for the Windows screen readers.
   * Currently, Windows Narrator, JAWS, or NVDA do not properly handle
   * inputs with MAX character limits. This function will create a new
   * invisible element w/ role='alert' that will be announced any time
   * the user attempts to input more characters past the character limit.
   * MacOS VoiceOver already properly handles this.
   * SIM: https://sim.amazon.com/issues/Chime-60786
   */
  const announceWindowsMaxLengthError = useDebouncedCallback(
    () => {
      if (!helpText) return;
      setWindowsAlert(helpText);
    },
    WINDOWS_INPUT_MAX_CHAR_ALERT_DELAY,
    { maxWait: WINDOWS_INPUT_MAX_CHAR_ALERT_DELAY, leading: true, trailing: false }
  );

  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => {
    clearTimeout(timerRef.current);
    if (windowsAlert) {
      timerRef.current = setTimeout(() => {
        setWindowsAlert('');
      }, WINDOWS_INPUT_MAX_CHAR_ALERT_DELAY);
    }
  }, [windowsAlert]);

  const handleKeyDown = (ev: KeyboardEvent) => {
    // max length handler for inputs
    const maxlen = maxLength || fieldProps?.maxLength;
    if (!maxlen) return;
    if (!(fieldName === 'input' || fieldName === 'textarea') || maxlen !== value?.length) return;
    // exit on only most commonly used keys that won't provide additional characters in input
    const isNonInputKey =
      ev.altKey ||
      ev.shiftKey ||
      ev.ctrlKey ||
      ev.metaKey ||
      ev.key === 'Backspace' ||
      ev.key === 'Enter' ||
      ev.key === 'Shift';

    if (isNonInputKey) return;
    announceWindowsMaxLengthError();
  };

  const renderLabel = () => {
    if (layout === 'input-only' && fieldName !== 'checkbox') {
      return null;
    }

    if (fieldName !== 'radiogroup') {
      return (
        <label htmlFor={labelId} className={`ch-${fieldName}-label`}>
          {label}
        </label>
      );
    }
    return false;
  };

  const baseClass = `form-field-wrapper ch-form-field-${fieldName} form-field-${layout}`;
  const classes = clsx(baseClass, className, {
    'ch-form-error': hasError,
  });

  return (
    <div className={classes} data-testid="form-field" {...rest}>
      {renderLabel()}
      {fieldName === 'radiogroup' ? (
        <fieldset aria-describedby={helpText && descriptionId} aria-invalid={hasError}>
          {label && <legend>{label}</legend>}
          <Field
            options={options}
            ref={ref}
            id={labelId}
            onChange={onChange}
            value={value}
            maxLength={maxLength}
            {...fieldProps}
          />
        </fieldset>
      ) : (
        <Tooltip tip={tip}>
          <span className="form-field-el-wrapper">
            <Field
              options={options}
              aria-label={fieldProps?.ariaLabel || (layout === 'input-only' && label) || null}
              aria-describedby={helpText && descriptionId}
              aria-invalid={hasError}
              ref={ref}
              id={labelId}
              onChange={onChange}
              value={value}
              checked={checked}
              maxLength={maxLength}
              onKeyDown={handleKeyDown}
              {...fieldProps}
            />
          </span>
        </Tooltip>
      )}
      <span className={'ch-help-text'} id={descriptionId} aria-live="polite">
        {helpText}
        {windowsAlert && <ScreenReaderContent role="alert">{windowsAlert}</ScreenReaderContent>}
      </span>
    </div>
  );
});

export default FormField;
