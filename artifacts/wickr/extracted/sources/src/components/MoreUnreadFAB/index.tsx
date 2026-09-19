import { clsx } from 'clsx';
import { MouseEventHandler } from 'react';
import { ArrowIcon, Button } from '@/componentlibrary';
import { useAppTranslation } from '@/lib/i18n';

import styles from './styles.module.less';

type Props = {
  onClick?: MouseEventHandler<HTMLButtonElement>;
  visible?: boolean;
};

// TODO: Theme for use with light mode later, for now use dark-theme
const MoreUnreadFAB: React.FC<Props> = ({ onClick, visible }) => {
  const { t } = useAppTranslation();
  return (
    <div
      aria-hidden
      className={clsx(styles.moreUnreadContainer, {
        [styles.visible]: visible,
      })}
    >
      <Button onClick={onClick} className={clsx(styles.btn, 'dark-theme')} tabIndex={-1}>
        <ArrowIcon direction="up" />
        {t('MoreUnread')}
      </Button>
    </div>
  );
};

export default MoreUnreadFAB;
