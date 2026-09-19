import { createContext } from 'react';
import { TabsStyle } from '.';

export type TabContextState = {
  activeIndex: number;
  onSelectTab: (index: number) => void;
  selectedLabel: string;
  variant: TabsStyle;
};

const initialState: TabContextState = {
  activeIndex: 0,
  onSelectTab: () => {},
  variant: 'underlined',
  selectedLabel: '',
};

export const TabContext = createContext<TabContextState>(initialState);
