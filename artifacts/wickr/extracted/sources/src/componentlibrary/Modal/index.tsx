import { clsx } from 'clsx';
import { FC, useEffect, useRef, HTMLAttributes, useLayoutEffect } from 'react';
import { BaseProps } from '../Base';
import useClickOutside from '@/hooks/useClickOutside';
import useUniqueId from '@/hooks/useUniqueId';
import { focusPreferredElement, isElement } from '@/utils/dom';
import { ModalContext } from './ModalContext';

import styles from './Modal.module.less';

export type ModalSize = keyof typeof sizeMapping;
export type ModalVariant = 'default' | 'alert';

export type ModalProps = HTMLAttributes<HTMLDivElement> &
  BaseProps & {
    /** The callback fired when the modal is closed. */
    onClose?: (e?: MouseEvent | TouchEvent) => void;
    /** The size of the modal. */
    size?: ModalSize;
    /** The rootId of the modal. */
    rootId?: string;
    /** Optional prop to prevent the modal from closing when clicking outside the modal. Default: true */
    closeOnOutsideClick?: boolean;
    /** Use to style modal header and footer based on different types */
    variant?: ModalVariant;
    /** Use to specific data-testid attribute for testing */
    testid?: string;
  } & (
    | {
        variant?: 'default';
        closeLabel: string;
      }
    | {
        variant?: 'alert';
        closeLabel?: never;
      }
  );

const sizeMapping = {
  sm: styles.sm,
  md: styles.md,
  lg: styles.lg,
  xl: styles.xl,
};

export const Modal: FC<ModalProps> = ({
  variant = 'default',
  size = 'sm',
  onClose = () => null,
  closeOnOutsideClick = true,
  children,
  className,
  testid = 'modal',
  closeLabel,
  ...rest
}) => {
  const labelId = useUniqueId();
  /** The container, which has the background coloring overlay */
  const containerRef = useRef<HTMLDivElement>(null);
  /** The section containing the actual modal */
  const mainEl = useRef<HTMLDivElement>(null);
  const modalContext = { onClose, labelId, closeLabel, variant };
  const classes = clsx(className, 'modalContainer', styles.modal, sizeMapping[size], {
    [styles.alert]: variant === 'alert',
  });

  useClickOutside(mainEl, (e) => {
    if (!closeOnOutsideClick) return;
    if (isElement(e.target)) {
      if (e.target.closest('[role="dialog"], [role="menu"]')) {
        return;
      }
    }
    e.stopPropagation();
    onClose();
  });

  useEffect(() => {
    if (mainEl?.current) {
      focusPreferredElement(mainEl.current);
    }
  }, []);

  useLayoutEffect(() => {
    // return focus to the element that triggered the
    // modal when the modal closes
    const activeNode: any = document.activeElement;
    return () => !!activeNode && activeNode.focus();
  }, []);

  return (
    <ModalContext.Provider value={modalContext}>
      <div className={classes} {...rest} ref={containerRef} data-testid={testid}>
        <section ref={mainEl} role="dialog" aria-labelledby={labelId}>
          {children}
        </section>
      </div>
    </ModalContext.Provider>
  );
};

export default Modal;
