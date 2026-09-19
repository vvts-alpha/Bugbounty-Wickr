import { clsx } from 'clsx';
import { FC } from 'react';
import { CaretIcon, Button, PopOver } from '@/componentlibrary';

import styles from './styles.module.less';

type ConvoTimeSelectorProps = {
  popOverOptions: (JSX.Element | undefined)[];
  id?: string;
  icon: JSX.Element;
  title: string;
  value: string;
};

export const ConvoSettingSelector: FC<ConvoTimeSelectorProps> = ({
  popOverOptions,
  id,
  icon,
  title,
  value,
}) => {
  return (
    <PopOver triggerType="click" anchorTo="cursor" popoverContent={popOverOptions}>
      <Button id={id} className={clsx(styles.fullWidthButton, styles.popoverButton)}>
        <div className={styles.rowWithGap}>
          {icon}
          {title}
        </div>
        <div className={clsx(styles.rowWithGap, styles.textWithCaret)}>
          {value}
          <CaretIcon direction="down" />
        </div>
      </Button>
    </PopOver>
  );
};
