import { clsx } from 'clsx';
import { FC, HTMLAttributes } from 'react';

import IconButton from '../Button/IconButton';
import { lineClamp } from '../Utilities';
import { CaretIcon, CloseIcon } from '../icons';
import { useModalContext } from './ModalContext';

import styles from './Modal.module.less';

type ModalHeaderProps = HTMLAttributes<HTMLDivElement> &
  (
    | {
        children: ReactJSXChild;
        as?: never;
        title?: never;
      }
    | {
        children?: never;
        /** The HTML tag of the header in the modal. */
        as?: React.ElementType;
        /** The title of the header in the modal. */
        title: string;
      }
  ) & {
    /** If true, the close button on the modal will be < (back) instead of x (close) */
    backButton?: boolean;
  };

export const ModalHeader: FC<ModalHeaderProps> = ({
  as,
  title,
  className,
  children,
  backButton,
  ...rest
}) => {
  const Tag = as || 'h2';
  const context = useModalContext();
  const handleClick = () => {
    return context && context.onClose?.();
  };
  const classes = clsx(className, styles.modalHeader);

  return (
    <header className={classes} {...rest}>
      {context.variant === 'default' && context.closeLabel && (
        <span className={clsx(styles.headerClose)}>
          <IconButton label={context.closeLabel} onClick={handleClick}>
            {backButton ? <CaretIcon direction="left" size="20px" /> : <CloseIcon size="20px" />}
          </IconButton>
        </span>
      )}
      {title ? (
        <Tag id={context.labelId} style={lineClamp(3)} className={clsx(styles.headerText)}>
          {title}
        </Tag>
      ) : (
        <>{children}</>
      )}
    </header>
  );
};

export default ModalHeader;
