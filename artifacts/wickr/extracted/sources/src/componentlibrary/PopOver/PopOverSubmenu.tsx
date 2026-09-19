import { clsx } from 'clsx';
import { useState } from 'react';
import { CaretIcon } from '../icons';
import PopOver, { PopOverProps } from './PopOver';
import PopOverItem, { PopOverItemProps } from './PopOverItem';

import styles from './PopOver.module.less';

type Props = Omit<PopOverProps, 'triggerType' | 'anchorTo' | 'isSubmenu' | 'onClose' | 'onOpen'> & {
  itemProps?: PopOverItemProps;
};

const PopOverSubmenu: ReactFC<Props> = ({ children, itemProps, ...props }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <PopOver
      placement="right-start"
      offset={[-4, 4]}
      {...props}
      isSubmenu
      onOpen={() => setIsOpen(true)}
      onClose={() => setIsOpen(false)}
    >
      <PopOverItem
        data-submenutrigger="true"
        className={clsx(styles.submenuTrigger, { isOpen })}
        {...itemProps}
      >
        <span className={styles.submenuLabel}>{children}</span>
        <CaretIcon direction="right" />
      </PopOverItem>
    </PopOver>
  );
};

export default PopOverSubmenu;
