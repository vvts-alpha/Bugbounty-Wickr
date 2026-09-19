import { FC, useMemo } from 'react';
import { PopOverItem, ExpirationTimerIcon, BurnOnReadIcon } from '@/componentlibrary';
import useConvoExpirationTimes from '@/hooks/useConvoExpirationTimes';
import { useAppTranslation } from '@/lib/i18n';
import { useSetting } from '@/store/hooks/useSetting';
import { formatRelativeTime } from '@/utils/date';

import { ConvoSettingSelector } from './ConvoSettingSelector';

export const CONVO_TIME_OFF_VALUE = 0;

type ConvoTimeSelectorProps = {
  convoId?: string;
  convoType: 'room' | 'dmOrGroup';
  /** True to show a "Custom" option at the bottom of the PopOver menu that allows users to set a custom time. */
  showCustomOption?: boolean;
  /** Value in milliseconds of the current selected time. Use CONVO_TIME_OFF_VALUE for "Off" if the option is enabled. */
  value: number;
  /** Called with the new time value in seconds when the selected time changes. */
  onChange: (value: number) => void;
  /** Called when the "Custom" option is clicked */
  onClickCustom?: () => void;
  /** id attribute attached to the button */
  id?: string;
} & (
  | {
      expirationType: 'bor';
      /** The current expiration time of the convo, even if just unsaved local state. This is used to limit the BOR time in convo UI. */
      currentTTL: number;
    }
  | {
      expirationType: 'ttl';
      currentTTL?: never;
    }
);

export const ConvoTimeSelector: FC<ConvoTimeSelectorProps> = ({
  convoId,
  expirationType,
  convoType,
  showCustomOption = true,
  value,
  onChange,
  onClickCustom,
  id,
  currentTTL,
}) => {
  const { t } = useAppTranslation();
  const { maxTTL, maxBOR, minBOR } = useConvoExpirationTimes(convoId);
  const availableEnvelopeBOR = useSetting('availableEnvelopeBOR');
  const availableEnvelopeTTL = useSetting('availableEnvelopeTTL');

  const { unit: displayUnit, amount: displayTime } = formatRelativeTime(value);

  const popOverOptions = useMemo(() => {
    const options = expirationType === 'bor' ? availableEnvelopeBOR : availableEnvelopeTTL;

    const items = options.map((ms) => {
      const max =
        expirationType === 'ttl' ? maxTTL : maxBOR ? Math.min(maxBOR, currentTTL) : currentTTL;
      if (ms > max) {
        return;
      }

      const { unit: displayUnit, amount: displayValue } = formatRelativeTime(ms);

      return (
        <PopOverItem checked={ms === value} onClick={() => onChange(ms)} key={ms}>
          {t('{{time, number}}', {
            time: displayValue,
            formatParams: {
              time: {
                unit: displayUnit,
                style: 'unit',
                unitDisplay: 'long',
              },
            },
          })}
        </PopOverItem>
      );
    });

    if (expirationType === 'bor' && minBOR === 0) {
      items.unshift(
        <PopOverItem
          checked={value === CONVO_TIME_OFF_VALUE}
          onClick={() => onChange(CONVO_TIME_OFF_VALUE)}
          key={CONVO_TIME_OFF_VALUE}
        >
          {t('Off')}
        </PopOverItem>
      );
    }

    if (showCustomOption) {
      items.push(
        <PopOverItem onClick={onClickCustom} key={'custom'}>
          {t('Custom')}
        </PopOverItem>
      );
    }

    return items;
  }, [
    currentTTL,
    availableEnvelopeBOR,
    availableEnvelopeTTL,
    maxTTL,
    maxBOR,
    convoType,
    expirationType,
    showCustomOption,
    value,
    onChange,
  ]);

  return (
    <ConvoSettingSelector
      popOverOptions={popOverOptions}
      id={id}
      icon={
        expirationType === 'bor' ? (
          <BurnOnReadIcon size="20px" />
        ) : (
          <ExpirationTimerIcon size="20px" />
        )
      }
      title={expirationType === 'bor' ? t('Burn-On-Read Timer') : t('Expiration Timer')}
      value={
        value === CONVO_TIME_OFF_VALUE
          ? t('Off')
          : t('{{time, number}}', {
              time: displayTime,
              formatParams: {
                time: {
                  unit: displayUnit,
                  style: 'unit',
                  unitDisplay: 'long',
                },
              },
            })
      }
    />
  );
};
