import { createContext, useContext } from 'react';
import { PanelCloseIcon } from '@/store/slices/panels';

export interface PanelContextValue {
  onClose: () => void;
  labelId: string;
  closeIcon: PanelCloseIcon;
}

export const PanelContext = createContext<PanelContextValue>({
  onClose() {},
  labelId: '',
  closeIcon: 'close',
});

export const usePanelContext = () => {
  return useContext(PanelContext);
};
