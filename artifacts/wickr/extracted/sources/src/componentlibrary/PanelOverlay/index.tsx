import { clsx } from 'clsx';
import { FC, HTMLAttributes } from 'react';
import IconButton from '../Button/IconButton';
import Heading from '../Heading';
import { CaretIcon } from '../icons';

import styles from './PanelOverlay.module.less';

type OverlayProps = Omit<HTMLAttributes<HTMLElement>, 'title'> & {
  title: ReactJSXChild;
} & (
    | {
        onClose?: never;
        closeLabel?: never;
      }
    | {
        onClose: () => void;
        closeLabel: string;
      }
  );

export const PanelOverlay: FC<OverlayProps> = ({
  title,
  onClose,
  closeLabel,
  children,
  className,
}) => {
  return (
    <section className={clsx(styles.overlay, 'panelOverlay', className)}>
      <Heading level={3} as="h1" className={styles.header}>
        {!!onClose && (
          <IconButton className={styles.closeBtn} onClick={onClose} label={closeLabel || ''}>
            <CaretIcon direction="left" size="20px" />
          </IconButton>
        )}
        {title}
      </Heading>
      {children}
    </section>
  );
};

export default PanelOverlay;
