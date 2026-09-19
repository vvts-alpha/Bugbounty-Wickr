import { clsx } from 'clsx';
import { useContext, MouseEvent, FC } from 'react';

import { ButtonProps, Button } from '../Button';
import { TabContext } from './TabContext';

import styles from './Tabs.module.less';

export type TabStyleProps = {
  className?: string;
  underlineClassName?: string;
};

type TabProps = ButtonProps &
  TabStyleProps & {
    index: number;
    ariaLabel: string;
  };

export const Tab: FC<TabProps> = ({
  children,
  index,
  className,
  underlineClassName,
  ariaLabel,
  ...rest
}) => {
  const { activeIndex, onSelectTab, variant, selectedLabel } = useContext(TabContext);

  const isActive = activeIndex === index;

  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    if (isActive) return; // Do not fire click events if it is already selected
    event.preventDefault();
    onSelectTab(index);
  };

  return (
    <div
      className={clsx(styles.tabWrapper, className, {
        [styles.underlined]: variant === 'underlined',
        [styles.bar]: variant === 'bar',
      })}
    >
      <Button
        className={styles.tabBtn}
        wrapperClassName={styles.tabBtnWrapper}
        aria-selected={isActive}
        onClick={handleClick}
        role="tab"
        {...rest}
        /**
         * TODO: (A11y Chromium Issue) Remove when chromium version is upgraded.
         * Manually append "selected" to the aria-label since aria-selected is not read in Qt with a screen reader.
         * If not selected, remove the aria-label and allow the children to be read normally.
         */
        aria-label={isActive ? `${ariaLabel}, ${selectedLabel}` : undefined}
      >
        {children}
      </Button>
      {isActive && variant === 'underlined' && (
        <div className={clsx(styles.underline, underlineClassName)} />
      )}
    </div>
  );
};

export default Tab;
