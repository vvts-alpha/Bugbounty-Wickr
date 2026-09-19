import { useEffect, useState } from 'react';
import { CheckIcon, CloseIcon, LinkIcon, StarIcon, ToastButton } from '@/componentlibrary';
import usePrevious from '@/hooks/usePrevious';
import { Logger } from '@/lib/logger';
import { useAppDispatch, useAppSelector } from '@/store';
import { useFeature } from '@/store/hooks/useFeature';
import { removeToast, selectToasts, ToastIcon } from '@/store/slices/toast';

import styles from './styles.module.less';

const logger = new Logger('Toast Notfications');

const DISMISS_AFTER_MS = 3000;
const MAX_TOAST_LENGTH = 10;

const ToastContainer: ReactFC = () => {
  const enabled = useFeature('Toasts');
  return enabled ? <InternalToastContainer /> : null;
};

const InternalToastContainer = () => {
  const toasts = useAppSelector(selectToasts);
  const dispatch = useAppDispatch();

  const [stackHeight, setStackHeight] = useState(0);
  const prevToastsLength = usePrevious(toasts.length) ?? 0;

  useEffect(() => {
    if (toasts.length > MAX_TOAST_LENGTH) {
      logger.warn(
        `Showing more than ${MAX_TOAST_LENGTH} toasts at once. Clearing oldest toast as they could overflow the window. Something bad might be happening.`
      );
      toasts.find(({ id }, idx) => {
        if (idx === 0) {
          dispatch(removeToast(id));
        }
      });
    }

    if (!toasts.length || stackHeight === MAX_TOAST_LENGTH) {
      setStackHeight(0);
      return;
    }
    if (prevToastsLength < toasts.length) {
      setStackHeight(stackHeight + 1);
    }
  }, [toasts, stackHeight]);

  const renderIcon = (icon?: ToastIcon) => {
    switch (icon) {
      case 'check':
        return <CheckIcon />;
      case 'link':
        return <LinkIcon />;
      case 'close':
        return <CloseIcon />;
      case 'star':
        return <StarIcon />;
      case 'star-filled':
        return <StarIcon filled />;
      default:
        return null;
    }
  };

  return (
    <div className={styles.toastContainer}>
      {toasts.map(({ label, icon, id, color, instanceId }) => (
        <ToastButton
          color={color}
          onDismiss={() => dispatch(removeToast(id))}
          dismissAfter={DISMISS_AFTER_MS}
          instanceId={instanceId}
          key={`${id}${instanceId}`}
          stackHeight={stackHeight}
        >
          {renderIcon(icon)} {label}
        </ToastButton>
      ))}
    </div>
  );
};

export default ToastContainer;
