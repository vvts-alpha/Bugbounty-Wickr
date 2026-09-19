import { clsx } from 'clsx';
import { FC, useRef, HTMLAttributes, useMemo } from 'react';

import { BaseProps } from '../Base';
import useClickOutside from '@/hooks/useClickOutside';
import useUniqueId from '@/hooks/useUniqueId';
import { PanelCloseIcon } from '@/store/slices/panels';
import { isElement } from '@/utils/dom';
import { PanelContext } from './PanelContext';

import styles from './Panel.module.less';

export type PanelSide = 'right' | 'left';

export interface PanelProps extends HTMLAttributes<HTMLDivElement>, BaseProps {
  /** The callback fired when the panel is closed. */
  onClose?: (e?: MouseEvent | TouchEvent) => void;
  /** Use to specific data-testid attribute for testing */
  testid?: string;
  side: PanelSide;
  onOutsideClick?: () => void;
  closeIcon?: PanelCloseIcon;
}

const noop = () => {};

export const Panel: FC<PanelProps> = ({
  onClose = noop,
  children,
  className,
  testid = 'panel',
  side,
  onOutsideClick,
  closeIcon = 'close',
  ...rest
}) => {
  const labelId = useUniqueId();
  const contentEl = useRef<HTMLDivElement>(null);
  const panelContext = useMemo(
    () => ({ onClose, labelId, closeIcon }),
    [onClose, labelId, closeIcon]
  );

  useClickOutside(contentEl, (e: MouseEvent | TouchEvent) => {
    // Prevent clicking on Popover Menus within Panels to dismiss the panel
    if (
      isElement(e.target) &&
      (e.target.closest('.popoverMenu') ||
        e.target.closest('.appNotification') ||
        e.target.closest('.panelOverlay') ||
        e.target.closest('.modalContainer'))
    ) {
      return;
    }
    onOutsideClick?.();
  });

  return (
    <PanelContext.Provider value={panelContext}>
      <section
        {...rest}
        className={clsx(className, styles.panel, {
          [styles.left]: side === 'left',
          [styles.right]: side === 'right',
        })}
        ref={contentEl}
        role="dialog"
        aria-labelledby={labelId}
        data-testid={testid}
      >
        {children}
      </section>
    </PanelContext.Provider>
  );
};

export default Panel;
