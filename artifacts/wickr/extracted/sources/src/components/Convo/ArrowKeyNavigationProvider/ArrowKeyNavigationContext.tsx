import { Dispatch, MutableRefObject, SetStateAction, createContext } from 'react';

type ContextType = {
  setArrowKeyNavMode: Dispatch<SetStateAction<boolean>>;
  activeMessageId: string;
  onRestoreFocus: MutableRefObject<Function | null>;
};

export const ArrowKeyNavigationContext = createContext<ContextType | null>(null);
