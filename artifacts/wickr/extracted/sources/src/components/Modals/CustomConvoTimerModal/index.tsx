import clamp from 'lodash/clamp';
import { ChangeEvent, useEffect, useLayoutEffect, useState } from 'react';
import {
  FormField,
  Modal,
  ModalBody,
  ModalButtonGroup,
  ModalHeader,
  PrimaryButton,
  Button,
} from '@/componentlibrary';
import useConvoExpirationTimes from '@/hooks/useConvoExpirationTimes';
import { AppTranslationKey, useAppTranslation } from '@/lib/i18n';
import { useAppDispatch, useAppSelector } from '@/store';
import { selectCustomConvoTimerModalParams } from '@/store/slices/modal';
import { closeModal } from '@/store/thunks/modals';
import {
  TimeUnit,
  formatRelativeTime,
  formatRelativeTimeToMs,
  formatToNearestRelativeTime,
} from '@/utils/date';
import { asHtmlElement } from '@/utils/dom';

import styles from './styles.module.less';

type DisplayTimeUnit = Exclude<TimeUnit, 'millisecond' | 'microsecond'>;

const TIMER_ELEMENT_TRANSLATIONS: Record<
  DisplayTimeUnit,
  { buttonLabel: AppTranslationKey; inputLabel: AppTranslationKey }
> = {
  day: { buttonLabel: 'Days', inputLabel: 'Total Number of Days' },
  hour: { buttonLabel: 'Hours', inputLabel: 'Total Number of Hours' },
  minute: { buttonLabel: 'Minutes', inputLabel: 'Total Number of Minutes' },
  second: { buttonLabel: 'Seconds', inputLabel: 'Total Number of Seconds' },
};
const TIME_UNIT_OPTIONS: DisplayTimeUnit[] = ['day', 'hour', 'minute', 'second'];

const CustomConvoTimerModal = () => {
  const { t } = useAppTranslation();
  const dispatch = useAppDispatch();
  const params = useAppSelector(selectCustomConvoTimerModalParams);
  const { maxBOR, maxTTL, minBOR, minTTL } = useConvoExpirationTimes(params.vGroupId);
  const [inputError, setInputError] = useState(false);
  const formattedInitialTime = formatToNearestRelativeTime(
    params.initialValue ?? (params.type === 'ttl' ? maxTTL : maxBOR)
  );
  const [selectedUnit, setSelectedUnit] = useState(formattedInitialTime.unit as DisplayTimeUnit);
  const [inputValue, setInputValue] = useState(formattedInitialTime.amount.toString());

  // BOR must be less than or equal to the TTL, but disregard maxBOR of 0
  const { amount: maxValue } = formatRelativeTime(
    params.type === 'bor' ? Math.min(maxBOR, params.currentTTL) : maxTTL,
    {
      unit: selectedUnit,
      roundingFunc: Math.floor,
    }
  );
  const { amount: minValue } = formatRelativeTime(params.type === 'bor' ? minBOR : minTTL, {
    unit: selectedUnit,
    roundingFunc: Math.ceil,
  });

  const showError = () => {
    setInputError(true);
  };

  const checkValueOutOfBounds = (value: string) => {
    const parsedInputValue = parseInt(value);
    return parsedInputValue < minValue || parsedInputValue > maxValue;
  };

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    const valueAsNumber = parseInt(value);

    if (!/^[0-9]*$/gm.test(value)) {
      // Keeping numbers only check here since input[type=number] will still allow "-" char
      return;
    }

    if (inputError) {
      setInputError(false);
    }

    if (value.length === 0) {
      setInputValue(value);
      return;
    }

    // Only clamp the max value and allow any input below the min value.
    const clampedInput = clamp(valueAsNumber, 0, maxValue);
    setInputValue(clampedInput.toString());
    if (checkValueOutOfBounds(value)) showError();
  };

  useEffect(() => {
    if (inputValue.length === 0) {
      return;
    }

    if (inputError) setInputError(false);

    // When the unit changes, keep the input value but clamp it
    const clampedInput = clamp(parseInt(inputValue), minValue, maxValue);
    setInputValue(clampedInput.toString());
  }, [selectedUnit]);

  const handleClose = () => {
    dispatch(closeModal('CustomConvoTimerModal'));
  };

  const handleSubmit = () => {
    if (inputValue.length > 0) {
      if (checkValueOutOfBounds(inputValue)) {
        showError();
        return;
      }

      const value = formatRelativeTimeToMs(parseInt(inputValue), selectedUnit, Math.ceil);
      dispatch(closeModal({ name: 'CustomConvoTimerModal', returnValue: value }));
    }

    handleClose();
  };

  useLayoutEffect(() => {
    // return focus to the element that triggered the
    // modal when the modal closes. Here we use the custom
    // originElement param since the popover element will be destroyed
    if (!params.originElementId) return;

    const activeNode = asHtmlElement(document.getElementById(params.originElementId));
    if (!activeNode) return;

    return () => activeNode.focus();
  }, [params]);

  return (
    <Modal closeLabel={t('Close')} size="md" onClose={handleClose}>
      <ModalHeader
        title={t(
          params.type === 'bor' ? 'Set Custom Burn-On-Read Timer' : 'Set Custom Expiration Timer'
        )}
      />
      <ModalBody className={styles.body}>
        <div className={styles.buttonRow}>
          {TIME_UNIT_OPTIONS.map((u) => {
            const oneUnitMs = formatRelativeTimeToMs(1, u);
            // Filter out buttons for TTL that are less than 1 unit for the maxTTL
            // and for BOR that are less than 1 unit for the maxBOR or the currentTTL
            if (
              params.type === 'ttl'
                ? maxTTL < oneUnitMs
                : (maxBOR !== 0 && maxBOR < oneUnitMs) ||
                  (params.currentTTL && params.currentTTL < oneUnitMs)
            )
              return;
            const isSelected = u === selectedUnit;
            const Component = isSelected ? PrimaryButton : Button;
            return (
              <Component bordered={!isSelected} key={u} onClick={() => setSelectedUnit(u)}>
                {TIMER_ELEMENT_TRANSLATIONS[u].buttonLabel}
              </Component>
            );
          })}
        </div>
        <form onSubmit={handleSubmit} className={styles.form}>
          <FormField
            fieldName="input"
            fieldProps={{
              showClear: false,
              type: 'number',
            }}
            label={t(TIMER_ELEMENT_TRANSLATIONS[selectedUnit].inputLabel)}
            onChange={handleInputChange}
            value={inputValue}
            hasError={inputError}
            infoContent={
              minValue === maxValue
                ? t('{{maxValue}} is the only valid value for {{units}}.', {
                    maxValue,
                    units: TIMER_ELEMENT_TRANSLATIONS[selectedUnit].buttonLabel.toLowerCase(),
                  })
                : t('Enter a time between {{min}} and {{max}}', {
                    min: minValue,
                    max: maxValue,
                  })
            }
          />
        </form>
      </ModalBody>
      <ModalButtonGroup>
        <Button bordered onClick={handleClose}>
          {t('Cancel')}
        </Button>
        <PrimaryButton onClick={handleSubmit}>{t('Save')}</PrimaryButton>
      </ModalButtonGroup>
    </Modal>
  );
};

export default CustomConvoTimerModal;
