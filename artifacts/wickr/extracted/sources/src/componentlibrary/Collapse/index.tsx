import { clsx } from 'clsx';
import { ReactNode } from 'react';

import { BaseProps } from '../Base';
import Tooltip from '../Tooltip';
import { CaretIcon } from '../icons';

import styles from './Collapse.module.less';

export interface CollapseProps extends BaseProps {
  /** The title of the Collapse */
  title: string;
  /* A wrapper to apply around the title, used for virtual list */
  titleWrapper?: ReactFC;
  /* An optional badge or icon to display adjacent to the title */
  badges?: ReactJSXChild;
  /** Classname to apply custom CSS styles to container */
  containerClassName?: string;
  /** Classname to apply custom CSS styles to title */
  titleClassName?: string;
  /** Whether or not the Collapse is collapsed by default */
  collapsed?: boolean;
  additionalContent?: ReactNode;
  /** The callback fired when the collapse is clicked. */
  onClick?: () => void;
  /** Optionally don't show the caret icon */
  showCaret?: boolean;
  /** Optional tooltip text over the caret */
  tip?: string;
}

export const Collapse: ReactFC<CollapseProps> = ({
  title,
  titleWrapper,
  badges,
  containerClassName,
  titleClassName,
  collapsed = true,
  additionalContent,
  children,
  onClick,
  showCaret = true,
  tip,
}) => {
  const TitleWrapper = titleWrapper;
  const renderTitle = () => {
    return (
      <div className={clsx(styles.collapseContainer, containerClassName)}>
        <button
          className={styles.collapseButton}
          onClick={onClick}
          data-testid="collapse-container"
          aria-expanded={!collapsed}
        >
          <span className={titleClassName}>{title}</span>
          {badges}
          {showCaret && (
            <Tooltip tip={tip}>
              <span className={styles.caret}>
                <CaretIcon direction={collapsed ? 'right' : 'down'} width="16px" height="16px" />
              </span>
            </Tooltip>
          )}
          {additionalContent}
        </button>
      </div>
    );
  };
  return (
    <>
      {TitleWrapper ? <TitleWrapper>{renderTitle()}</TitleWrapper> : renderTitle()}
      <div className={clsx(styles.children, { [styles.expanded]: !collapsed })}>{children}</div>
    </>
  );
};

export default Collapse;
