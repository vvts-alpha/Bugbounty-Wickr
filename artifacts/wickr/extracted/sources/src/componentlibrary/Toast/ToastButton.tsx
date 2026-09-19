import { clsx } from 'clsx';
import { useEffect, useState } from 'react';
import Button, { ButtonProps } from '../Button';
import useConst from '@/hooks/useConst';
import { ToastColor } from '@/store/slices/toast';

import styles from './Toast.module.less';

type Props = Omit<ButtonProps, 'onClick' | 'color'> & {
  /** Called onClick or after dismissAfter elapses */
  onDismiss?: () => void;
  /** how long to wait before calling onDismiss (ms) */
  dismissAfter: number;
  color?: ToastColor;
  /** Reset dismiss timer whenever this changes */
  instanceId: number;
  stackHeight: number;
};

const colorToClassName = {
  primary: styles.primary,
  secondary: styles.secondary,
  green: styles.green,
  red: styles.red,
};

const TOAST_HEIGHT = 52;
const SLIDE_DURATION = 500;

export const ToastButton: ReactFC<Props> = ({
  className,
  color,
  dismissAfter,
  children,
  onDismiss,
  instanceId,
  stackHeight,
  ...props
}) => {
  const [slideIn, setSlideIn] = useState(false);
  const [slideOut, setSlideOut] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const height = useConst(() => stackHeight);

  useEffect(() => {
    // Sometimes the state is applied before the transform occurs
    const slideInTimer = setTimeout(() => setSlideIn(true), 50);
    return () => clearTimeout(slideInTimer);
  }, []);

  useEffect(() => {
    if (dismissed) {
      onDismiss?.();
    } else {
      const slideOutTimer = setTimeout(() => setSlideOut(true), dismissAfter);
      const handle = setTimeout(() => setDismissed(true), dismissAfter + SLIDE_DURATION);
      return () => {
        clearTimeout(slideOutTimer);
        clearTimeout(handle);
      };
    }
  }, [dismissAfter, dismissed, instanceId]);

  return (
    <Button
      {...props}
      className={clsx(styles.toast, className, color && colorToClassName[color], {
        [styles.slideIn]: slideIn,
        [styles.slideOut]: slideOut,
      })}
      style={{ bottom: `calc(${height} * ${TOAST_HEIGHT}px)` }}
      onClick={onDismiss}
      wrapperClassName={styles.toastBtnWrapper}
    >
      {children}
    </Button>
  );
};

export default ToastButton;
