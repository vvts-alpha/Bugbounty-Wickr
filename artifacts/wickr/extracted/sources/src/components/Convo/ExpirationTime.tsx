import { clsx } from 'clsx';
import { FC, useEffect, useState } from 'react';
import { BurnOnReadIcon, StopWatchIcon } from '@/componentlibrary/icons';
import { useAppTranslation } from '@/lib/i18n';
import { RelativeTime, formatRelativeTime } from '@/utils/date';

import { useExpirationInterval } from './ExpirationIntervalContext';
import styles from './Convo.module.less';

export type LabelFormat = 'convo' | 'panel';
export interface ExpirationTimeProps {
  /** The time when the message will expire in milliseconds. */
  expiresAt: number;
  /** Called when the formatted expiration time updates */
  onExpirationTimeChanged?: (time: RelativeTime) => void;
  /** Expiration time label format */
  labelFormat?: LabelFormat;
  /** The expiration time is reset by burn-on-read setting or not */
  isBor?: boolean;
}

export const ExpirationTime: FC<ExpirationTimeProps> = ({
  expiresAt,
  onExpirationTimeChanged,
  labelFormat = 'convo',
  isBor,
}) => {
  const { t } = useAppTranslation();
  const [secondsUntilExpiration, setSecondsUntilExpiration] = useState<number>();
  const [relativeTime, setRelativeTime] = useState<RelativeTime>();

  useExpirationInterval((timeSkewed) => {
    const msUntilExpiration = expiresAt - timeSkewed;
    const newRelativeExpirationTime = formatRelativeTime(msUntilExpiration);

    // Time display updated
    if (
      !relativeTime ||
      newRelativeExpirationTime.amount !== relativeTime.amount ||
      newRelativeExpirationTime.unit !== relativeTime.unit
    ) {
      setSecondsUntilExpiration(msUntilExpiration / 1000);
      setRelativeTime(newRelativeExpirationTime);
    }
  });

  useEffect(() => {
    if (!relativeTime) {
      return;
    }

    onExpirationTimeChanged?.(relativeTime);
  }, [relativeTime]);

  const getExpirationTimeString = () => {
    if (!relativeTime) {
      return;
    }
    if (labelFormat === 'panel') {
      return t(`Message expires {{expireIn, relativetime}}`, {
        expireIn: relativeTime.amount,
        formatParams: {
          expireIn: { range: relativeTime.unit },
        },
      });
    } else {
      const expTime = t('Message.ExpirationTime', {
        expireIn: relativeTime.amount,
        formatParams: {
          expireIn: {
            style: 'unit',
            notation: 'compact',
            unitDisplay: 'narrow',
            unit: relativeTime.unit,
          },
        },
      });

      // FIXME: use i18n to convert to uppercase "D" only for 'day' unit
      const expirationTimeString = relativeTime.unit === 'day' ? expTime.toUpperCase() : expTime;
      return '(' + expirationTimeString + ')';
    }
  };

  return relativeTime ? (
    labelFormat === 'panel' ? (
      <span
        className={clsx(styles.panelExpirationTimeLabel, {
          [styles.red]: secondsUntilExpiration && secondsUntilExpiration < 300,
        })}
      >
        <span>{getExpirationTimeString()}</span>
        {isBor ? <BurnOnReadIcon /> : <StopWatchIcon />}
      </span>
    ) : (
      <span className={styles.expirationTime} aria-hidden="true">
        <span
          className={clsx({
            [styles.red]: secondsUntilExpiration && secondsUntilExpiration < 300,
          })}
        >
          {getExpirationTimeString()}
        </span>
      </span>
    )
  ) : null;
};
