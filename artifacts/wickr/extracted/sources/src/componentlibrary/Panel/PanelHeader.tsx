import { clsx } from 'clsx';
import { FC, HTMLAttributes } from 'react';

import { BaseProps } from '../Base';
import IconButton from '../Button/IconButton';
import { Heading } from '../Heading';
import { lineClamp } from '../Utilities';
import { CaretIcon, CloseIcon } from '../icons';
import { usePanelContext } from './PanelContext';

import styles from './Panel.module.less';

export interface PanelHeaderProps extends HTMLAttributes<HTMLDivElement>, BaseProps {
  /** The title of the header in the panel. */
  title?: string;
  closeLabel: string;
  /** Optional element to display in the header row (right-aligned). Use a fragment for multiple items. */
  trailingElement?: ReactJSXChild;
}

export const PanelHeader: FC<PanelHeaderProps> = ({
  title,
  closeLabel,
  className,
  children,
  trailingElement,
  ...rest
}) => {
  const { onClose, closeIcon, labelId } = usePanelContext();
  const handleClick = () => {
    return onClose();
  };
  const classes = clsx(className, styles.panelHeader);

  return (
    <header {...rest} className={classes}>
      <div className={styles.panelHeaderRow}>
        <IconButton label={closeLabel} onClick={handleClick}>
          {closeIcon === 'left-caret' ? (
            <CaretIcon direction="left" size="1.25rem" />
          ) : (
            <CloseIcon size="1.25rem" />
          )}
        </IconButton>
        <Heading level={2} as="h2" id={labelId} style={lineClamp(3)} className={styles.title}>
          {title}
        </Heading>
        {trailingElement && (
          <span className={styles.trailingComponentContainer}>{trailingElement}</span>
        )}
      </div>
      {children}
    </header>
  );
};

export default PanelHeader;
