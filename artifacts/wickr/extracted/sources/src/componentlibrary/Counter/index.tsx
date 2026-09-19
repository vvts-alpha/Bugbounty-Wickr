import { clsx } from 'clsx';
import clamp from 'lodash/clamp';
import { FC, KeyboardEvent, useEffect, useState } from 'react';

import Button from '../Button';
import useLatestCallback from '@/hooks/useLatestCallback';
import { useAppTranslation } from '@/lib/i18n';
import { safeInterval } from '@/utils/safeInterval';

import styles from './styles.module.less';

type CounterProps = {
  count: number;
  step: number;
  min: number;
  max: number;
  initialRepeatDelay?: number;
  repeatDelay?: number;
  onChange?: (count: number) => void;
  className?: string;
  description?: string;
};

export const Counter: FC<CounterProps> = ({
  count,
  step,
  min,
  max,
  initialRepeatDelay = 300,
  repeatDelay = 100,
  onChange,
  className,
  description,
}) => {
  const [sign, setSign] = useState(0);
  const [shouldRepeat, setShouldRepeat] = useState(false);
  const [isMouseDown, setIsMouseDown] = useState(false);
  const { t } = useAppTranslation();

  useEffect(() => {
    if (!isMouseDown) return;
    const timer = setTimeout(() => setShouldRepeat(true), initialRepeatDelay);
    return () => clearTimeout(timer);
  }, [isMouseDown, initialRepeatDelay]);

  // After delay, start inc/dec interval
  const updateCount = useLatestCallback(() => onChange?.(clamp(count + sign * step, min, max)));
  useEffect(() => {
    if (!shouldRepeat) return;
    const cancel = safeInterval(updateCount, repeatDelay);
    return cancel;
  }, [shouldRepeat, repeatDelay]);

  const start = (sign: number) => {
    setIsMouseDown(true);
    setSign(sign);
  };

  const stop = () => {
    if (!shouldRepeat) updateCount();
    setIsMouseDown(false);
    setShouldRepeat(false);
    setSign(0);
  };

  const handleKeyDown = (event: KeyboardEvent, sign: number) => {
    if (event.key === 'Enter' || event.code === 'Space') {
      start(sign);
    }
  };

  const handleKeyUp = (event: KeyboardEvent) => {
    if (event.key === 'Enter' || event.code === 'Space') {
      stop();
    }
  };

  return (
    <div
      className={clsx(styles.counterContainer, className)}
      aria-label={t('counter')}
      aria-description={description}
    >
      <Button
        onMouseDown={() => start(-1)}
        onKeyDown={(e) => handleKeyDown(e, -1)}
        onKeyUp={handleKeyUp}
        onMouseUp={stop}
        onMouseLeave={stop}
        className={styles.button}
      >
        -
      </Button>
      <span aria-label={t('counter value')}>{count}</span>
      <Button
        onMouseDown={() => start(1)}
        onKeyDown={(e) => handleKeyDown(e, 1)}
        onKeyUp={handleKeyUp}
        onMouseUp={stop}
        onMouseLeave={stop}
        className={styles.button}
      >
        +
      </Button>
    </div>
  );
};
