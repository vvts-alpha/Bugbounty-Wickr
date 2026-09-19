import clsx from 'clsx';
import { AddIcon, Button } from '@/componentlibrary';

import styles from './styles.module.less';

export const TrailingAddButton: React.FC<{ text: string; onClick: AnyFunction }> = ({
  text,
  onClick,
}) => (
  <Button className={clsx(styles.convoTitle, styles.trailingBtn)} onClick={onClick}>
    <AddIcon className={styles.addIcon} size="12px" />
    {text}
  </Button>
);
