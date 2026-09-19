import clsx from 'clsx';

import { t } from 'i18next';
import IconButton from '../Button/IconButton';
import { CloseIcon } from '../icons';

import styles from './styles.module.less';

type Props = {
  className?: string;
  onClose?: () => void;
  severity?: 'info' | 'warning' | 'alert';
};

export const Banner: ReactFC<Props> = ({ className, children, onClose, severity, ...props }) => {
  return (
    <div
      className={clsx(styles.banner, className, {
        [styles.info]: severity === 'info',
        [styles.warning]: severity === 'warning',
        [styles.alert]: severity === 'alert',
        [styles.dismissible]: !!onClose,
      })}
      {...props}
    >
      {onClose && (
        <IconButton label={t('Close')} onClick={onClose} wrapperClassName={styles.closeBtn}>
          <CloseIcon size="20px" />
        </IconButton>
      )}
      {children}
    </div>
  );
};
