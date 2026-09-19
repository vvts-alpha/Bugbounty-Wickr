import { clsx } from 'clsx';
import { FC } from 'react';
import { Button } from '@/componentlibrary';
import CrossBoundaryClassificationTag from '@/components/Convo/CrossBoundaryClassificationTag';

import styles from './styles.module.less';

interface RowProps {
  selected: boolean;
  onClick: () => void;
  title: ReactJSXChild;
  subtitle?: ReactJSXChild;
  avatar: ReactJSXChild;
  trailingContent?: ReactJSXChild;
  crossBoundary?: boolean;
}

export const Row: FC<RowProps> = ({
  selected,
  onClick,
  title,
  subtitle,
  avatar,
  trailingContent,
  crossBoundary,
}) => {
  return (
    <div className={styles.buttonRow}>
      <Button
        onClick={onClick}
        wrapperClassName={styles.rowBtnWrapper}
        className={clsx(styles.rowBtn, { [styles.selected]: selected })}
      >
        <div className={clsx(styles.infoContainer)}>
          <div className={styles.avatarWrapper}>
            <div className={styles.avatar}>{avatar}</div>
          </div>
          {crossBoundary && <CrossBoundaryClassificationTag className={styles.crossBoundaryTag} />}
          <div className={styles.info}>
            <p>{title}</p>
            <p className={styles.subtitle}>{subtitle}</p>
          </div>
          <div className={styles.trailingContent}>{trailingContent}</div>
        </div>
      </Button>
    </div>
  );
};

export default Row;
