import { clsx } from 'clsx';
import React, { forwardRef, useState, Ref, useEffect } from 'react';

import { BaseProps } from '../Base';
import { TabContext } from './TabContext';

import styles from './Tabs.module.less';

export type TabsStyle = 'bar' | 'underlined';

export interface TabsProps extends BaseProps {
  /** Children of this component, which will be Tabs and their children */
  children: React.ReactNode;
  /** Callback that will fire on every tab click */
  onSelectTab?: (index: number) => void;
  /** Control the active tab from outside of this component */
  activeTab?: number;
  /** The translated string appended to the aria-label of the selected tab while screen-reader compatibility is limited in Qt  */
  selectedLabel: string;
  /** Style variations of Tabs */
  variant?: TabsStyle;
}

export const Tabs = forwardRef((props: TabsProps, ref: Ref<HTMLDivElement>) => {
  const {
    children,
    onSelectTab,
    className,
    activeTab,
    selectedLabel,
    variant = 'underlined',
    ...rest
  } = props;

  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (activeTab !== undefined && activeTab >= 0) {
      updateTab(activeTab);
    }
  }, [activeTab]);

  const updateTab = (index: number, clicked = false) => {
    setActiveIndex(index);

    // Only fire the callback if it was clicked
    if (clicked) {
      onSelectTab?.(index);
    }
  };

  return (
    <TabContext.Provider
      value={{
        activeIndex,
        onSelectTab: (idx) => updateTab(idx, true),
        selectedLabel,
        variant,
      }}
    >
      <div
        ref={ref}
        role="tablist"
        className={clsx(styles.tabs, className, {
          [styles.underlined]: variant === 'underlined',
          [styles.bar]: variant === 'bar',
        })}
        {...rest}
      >
        {children}
      </div>
    </TabContext.Provider>
  );
});

if (__DEV__) Tabs.displayName = 'Tabs';

export default Tabs;
