import clsx from 'clsx';
import { FC, ReactNode } from 'react';
import { Button } from '@/componentlibrary';
import styles from './styles.module.less';

interface Props {
  title: string;
  description?: string;
  onClick?: () => void;
  icon?: ReactNode;
}

export const SimpleSearchListItem: FC<Props> = ({ title, description, onClick, icon }) => {
  return (
    <Button
      wrapperClassName={styles.btnWrapper}
      className={clsx(styles.simpleSearchListItem)}
      onClick={onClick}
    >
      <div className={styles.titleWithIcon}>
        {icon && <div className={styles.iconWrapper}>{icon}</div>}
        <p className={styles.title}>{title}</p>
      </div>
      {description && <span className={styles.description}>{description}</span>}
    </Button>
  );
};
