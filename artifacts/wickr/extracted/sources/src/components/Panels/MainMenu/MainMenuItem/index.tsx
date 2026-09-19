import { clsx } from 'clsx';
import { ReactNode } from 'react';
import { Button } from '@/componentlibrary';

import styles from './styles.module.less';

type Props = {
  onClick?: () => void;
  icon?: ReactNode;
  label: string | ReactNode;
  selected?: boolean;
};

export const MainMenuItem: React.FC<Props> = ({ onClick, icon, label, selected }) => {
  // VoiceOver cannot read <li> tags in the QT WebEngine
  return (
    <div className={styles.itemWrapper}>
      <Button className={clsx(styles.itemBtn, { [styles.selected]: selected })} onClick={onClick}>
        {icon && <span className={styles.icon}>{icon}</span>}
        <p className={styles.label}>{label}</p>
      </Button>
    </div>
  );
};

export default MainMenuItem;
