import { createContext, useContext } from 'react';
import { ModalVariant } from '.';

type ModalContextType = {
  onClose?: () => void;
  labelId: string;
  closeLabel?: string;
  variant: ModalVariant;
};

export const ModalContext = createContext<ModalContextType>({
  onClose() {},
  labelId: '',
  closeLabel: '',
  variant: 'default',
});

export const useModalContext = () => {
  return useContext(ModalContext);
};
